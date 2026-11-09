import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { SMS_PROVIDER, SmsProvider } from './sms-provider';
import { evaluateSmsPolicy, resolvePrefs, SkipReason, startOfMonthUtc } from './policy/sms-policy';
import { renderSms } from './sms-templates';
import { parsePhone } from './phone';
import { TrackingLinkService } from './tracking-link.service';

export const NOTIFICATIONS_QUEUE = 'notifications';
export const SEND_ATTEMPTS = 3;
export const BACKOFF_MS = 5000;

export interface RequestNotificationInput {
  interventionId: string;
  kind: NotificationKind;
  /** Part of the idempotency key (interventionId:kind:version). */
  version?: string | number;
  /** New ETA the SMS is about (ETA_UPDATE / EN_ROUTE / DELAY). */
  newEta?: Date | null;
  /** Tenant scope; required for user-triggered requests. */
  businessId?: string;
  /** Dashboard-triggered send: bypasses prefs and ETA thresholds. */
  manual?: boolean;
}

export type RequestResult =
  | { status: 'queued'; notificationId: string }
  | { status: 'duplicate'; notificationId: string }
  | { status: 'failed'; notificationId: string; reason: string }
  | { status: 'skipped'; reason: SkipReason };

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly links: TrackingLinkService,
    @Inject(SMS_PROVIDER) private readonly provider: SmsProvider,
  ) {}

  /**
   * Evaluates policy and reserves quota atomically: the Business row is locked
   * (FOR UPDATE) so concurrent requests cannot overrun quota, the 5-SMS cap or
   * the ETA window. The queue add happens after commit; if it fails the row
   * stays QUEUED and `requeueStale()` / a retry of the same request re-enqueues it.
   */
  async request(input: RequestNotificationInput, now = new Date()): Promise<RequestResult> {
    const { interventionId, kind } = input;
    const iv = await this.prisma.intervention.findFirst({
      where: { id: interventionId, ...(input.businessId ? { businessId: input.businessId } : {}) },
      select: { businessId: true },
    });
    if (!iv) throw new NotFoundException('intervention_not_found');

    const version =
      input.version ?? (input.manual ? `m${now.getTime()}` : input.newEta ? Math.floor(input.newEta.getTime() / 60000) : 1);
    const idempotencyKey = `${interventionId}:${kind}:${version}`;

    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${iv.businessId} FOR UPDATE`;
      await this.rollPeriod(tx, iv.businessId, now);

      const existing = await tx.notification.findUnique({ where: { idempotencyKey } });
      if (existing) return { result: { status: 'duplicate', notificationId: existing.id } as RequestResult, requeue: existing.status === 'QUEUED' ? existing.id : null };

      const full = await tx.intervention.findUniqueOrThrow({
        where: { id: interventionId },
        include: { business: true, customer: true, technician: { include: { user: true } }, trackingSessions: true },
      });
      const history = await tx.notification.findMany({
        where: { interventionId, status: { not: 'FAILED' } },
        select: { createdAt: true },
      });
      const lastSentAt = history.reduce<Date | null>(
        (acc, n) => (!acc || n.createdAt > acc ? n.createdAt : acc),
        null,
      );
      const decision = evaluateSmsPolicy({
        kind,
        status: full.status,
        prefs: resolvePrefs(full.business.notificationPrefs),
        sentCount: history.length,
        lastSentAt,
        lastNotifiedEta: full.trackingSessions[0]?.lastNotifiedEtaAt ?? null,
        newEta: input.newEta ?? null,
        quotaRemaining: full.business.smsQuotaMonthly - full.business.smsUsedThisPeriod,
        now,
        manual: input.manual,
      });

      const base = { interventionId, kind, channel: 'SMS' as const, idempotencyKey };
      const failed = async (reason: string) => {
        const n = await tx.notification.create({
          data: { ...base, to: full.customer.phone, body: '', status: 'FAILED', error: reason },
        });
        return { result: { status: 'failed', notificationId: n.id, reason } as RequestResult, requeue: null };
      };
      if (!decision.allow) {
        if (decision.reason === 'quota_exceeded') return failed('quota_exceeded');
        this.logger.log(`skip ${idempotencyKey}: ${decision.reason}`);
        return { result: { status: 'skipped', reason: decision.reason } as RequestResult, requeue: null };
      }
      const phone = parsePhone(full.customer.phone);
      if (!phone) return failed('invalid_phone');

      const trackingLink = await this.links.issue(full, now, tx);
      const { body, warning } = renderSms(kind, {
        businessName: full.business.name,
        trackingLink,
        technicianFirstName: full.technician?.user.firstName,
        eta: input.newEta,
        delayMinutes: full.delayMinutes,
        timezone: full.business.timezone,
      });
      if (warning) this.logger.warn(`SMS ${idempotencyKey} exceeds one segment`);

      const n = await tx.notification.create({
        data: { ...base, to: phone.e164, body, provider: this.provider.name },
      });
      await tx.business.update({ where: { id: full.businessId }, data: { smsUsedThisPeriod: { increment: 1 } } });
      if (input.newEta) {
        await tx.trackingSession.updateMany({ where: { interventionId }, data: { lastNotifiedEtaAt: input.newEta } });
      }
      return { result: { status: 'queued', notificationId: n.id } as RequestResult, requeue: n.id };
    });

    if (outcome.requeue) await this.enqueue(outcome.requeue);
    return outcome.result;
  }

  private async enqueue(notificationId: string): Promise<boolean> {
    try {
      await this.queue.add(
        'send',
        { notificationId },
        {
          jobId: notificationId, // idempotent: re-adding an existing job is a no-op
          attempts: SEND_ATTEMPTS,
          backoff: { type: 'exponential', delay: BACKOFF_MS },
          removeOnComplete: true,
        },
      );
      return true;
    } catch (e) {
      this.logger.error(`enqueue failed for ${notificationId}; reconciler will retry`, e as Error);
      return false;
    }
  }

  /** Re-enqueues QUEUED rows older than `olderThanMs` (Redis outage / crash between commit and add). */
  async requeueStale(olderThanMs = 60_000, now = new Date()): Promise<number> {
    const stale = await this.prisma.notification.findMany({
      where: { status: 'QUEUED', createdAt: { lt: new Date(now.getTime() - olderThanMs) } },
      select: { id: true },
      take: 100,
    });
    let n = 0;
    for (const s of stale) if (await this.enqueue(s.id)) n++;
    return n;
  }

  /** Called by the queue processor. Throws on failure so BullMQ retries. */
  async deliver(notificationId: string, finalAttempt: boolean): Promise<void> {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { intervention: { select: { status: true, businessId: true } } },
    });
    if (!n || n.status !== 'QUEUED') return;

    // Re-check eligibility right before sending (queue delay / retry backoff).
    const st = n.intervention.status;
    if (st === 'COMPLETED' || (st === 'CANCELLED' && n.kind !== 'CANCELLED')) {
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { status: 'FAILED', error: 'intervention_terminal' },
      });
      await this.refundQuota(n.intervention.businessId);
      return;
    }
    try {
      const { providerMessageId } = await this.provider.send(n.to, n.body, n.idempotencyKey);
      await this.prisma.notification.update({
        where: { id: n.id },
        data: {
          status: 'SENT',
          providerMessageId,
          provider: this.provider.name,
          attempts: { increment: 1 },
          error: null,
        },
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { attempts: { increment: 1 }, error, ...(finalAttempt ? { status: 'FAILED' } : {}) },
      });
      if (finalAttempt) await this.refundQuota(n.intervention.businessId);
      throw e;
    }
  }

  /** Entry point for a real provider's delivery-status callback (future adapter). */
  async applyDeliveryStatus(
    providerMessageId: string,
    status: 'DELIVERED' | 'FAILED',
    error?: string,
  ): Promise<void> {
    const res = await this.prisma.notification.updateMany({
      where: { providerMessageId },
      data: { status, error: status === 'FAILED' ? (error ?? 'delivery_failed') : null },
    });
    if (res.count === 0) this.logger.warn(`delivery status for unknown message ${providerMessageId}`);
  }

  async getUsage(businessId: string, now = new Date()) {
    await this.rollPeriod(this.prisma, businessId, now);
    const b = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    return {
      quota: b.smsQuotaMonthly,
      used: b.smsUsedThisPeriod,
      remaining: Math.max(0, b.smsQuotaMonthly - b.smsUsedThisPeriod),
      periodStart: b.smsPeriodStart,
    };
  }

  /** Atomic monthly rollover (UTC calendar month): resets usage when the period start is stale. */
  private async rollPeriod(db: Prisma.TransactionClient | PrismaService, businessId: string, now: Date) {
    const start = startOfMonthUtc(now);
    await db.business.updateMany({
      where: { id: businessId, smsPeriodStart: { lt: start } },
      data: { smsUsedThisPeriod: 0, smsPeriodStart: start },
    });
  }

  /** Prefilled text + link for copy / native share / `sms:` deep link. */
  async buildShareMessage(
    interventionId: string,
    scope: { businessId: string; technicianUserId?: string },
    kind: NotificationKind = 'EN_ROUTE',
  ) {
    const iv = await this.prisma.intervention.findFirst({
      where: {
        id: interventionId,
        businessId: scope.businessId,
        ...(scope.technicianUserId ? { technician: { userId: scope.technicianUserId } } : {}),
      },
      include: { business: true, customer: true, technician: { include: { user: true } }, trackingSessions: true },
    });
    if (!iv) throw new NotFoundException('intervention_not_found');
    const link = await this.links.issue(iv);
    const { body } = renderSms(kind, {
      businessName: iv.business.name,
      trackingLink: link,
      technicianFirstName: iv.technician?.user.firstName,
      eta: iv.trackingSessions[0]?.etaAt,
      delayMinutes: iv.delayMinutes,
      timezone: iv.business.timezone,
    });
    const phone = parsePhone(iv.customer.phone);
    return {
      text: body,
      link,
      smsUri: `sms:${phone?.e164 ?? ''}?body=${encodeURIComponent(body)}`,
    };
  }

  private async refundQuota(businessId: string) {
    await this.prisma.business.updateMany({
      where: { id: businessId, smsUsedThisPeriod: { gt: 0 } },
      data: { smsUsedThisPeriod: { decrement: 1 } },
    });
  }
}
