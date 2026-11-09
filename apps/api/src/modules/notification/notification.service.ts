import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { SMS_PROVIDER, SmsProvider } from './sms-provider';
import { evaluateSmsPolicy, resolvePrefs, SkipReason } from './policy/sms-policy';
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

  async request(input: RequestNotificationInput, now = new Date()): Promise<RequestResult> {
    const { interventionId, kind } = input;
    const iv = await this.prisma.intervention.findUnique({
      where: { id: interventionId },
      include: {
        business: true,
        customer: true,
        technician: { include: { user: true } },
        trackingSessions: true,
      },
    });
    if (!iv) throw new NotFoundException('intervention_not_found');

    const version =
      input.version ?? (input.manual ? `m${now.getTime()}` : input.newEta ? Math.floor(input.newEta.getTime() / 60000) : 1);
    const idempotencyKey = `${interventionId}:${kind}:${version}`;

    const existing = await this.prisma.notification.findUnique({ where: { idempotencyKey } });
    if (existing) return { status: 'duplicate', notificationId: existing.id };

    const history = await this.prisma.notification.findMany({
      where: { interventionId, status: { not: 'FAILED' } },
      select: { createdAt: true },
    });
    const lastSentAt = history.reduce<Date | null>(
      (acc, n) => (!acc || n.createdAt > acc ? n.createdAt : acc),
      null,
    );

    const decision = evaluateSmsPolicy({
      kind,
      status: iv.status,
      prefs: resolvePrefs(iv.business.notificationPrefs),
      sentCount: history.length,
      lastSentAt,
      lastNotifiedEta: iv.trackingSessions[0]?.lastNotifiedEtaAt ?? null,
      newEta: input.newEta ?? null,
      quotaRemaining: iv.business.smsQuotaMonthly - iv.business.smsUsedThisPeriod,
      now,
      manual: input.manual,
    });

    const base = { interventionId, kind, channel: 'SMS' as const, idempotencyKey };
    if (!decision.allow) {
      if (decision.reason !== 'quota_exceeded') {
        this.logger.log(`skip ${idempotencyKey}: ${decision.reason}`);
        return { status: 'skipped', reason: decision.reason };
      }
      const n = await this.prisma.notification.create({
        data: { ...base, to: iv.customer.phone, body: '', status: 'FAILED', error: 'quota_exceeded' },
      });
      return { status: 'failed', notificationId: n.id, reason: 'quota_exceeded' };
    }

    const phone = parsePhone(iv.customer.phone);
    if (!phone) {
      const n = await this.prisma.notification.create({
        data: { ...base, to: iv.customer.phone, body: '', status: 'FAILED', error: 'invalid_phone' },
      });
      return { status: 'failed', notificationId: n.id, reason: 'invalid_phone' };
    }

    const trackingLink = await this.links.issue(interventionId, now);
    const { body, warning } = renderSms(kind, {
      businessName: iv.business.name,
      trackingLink,
      technicianFirstName: iv.technician?.user.firstName,
      eta: input.newEta,
      delayMinutes: iv.delayMinutes,
      timezone: iv.business.timezone,
    });
    if (warning) this.logger.warn(`SMS ${idempotencyKey} exceeds one segment`);

    let notification;
    try {
      notification = await this.prisma.notification.create({
        data: { ...base, to: phone.e164, body, provider: this.provider.name },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const dup = await this.prisma.notification.findUniqueOrThrow({ where: { idempotencyKey } });
        return { status: 'duplicate', notificationId: dup.id };
      }
      throw e;
    }

    await this.prisma.business.update({
      where: { id: iv.businessId },
      data: { smsUsedThisPeriod: { increment: 1 } },
    });
    if (input.newEta) {
      await this.prisma.trackingSession.updateMany({
        where: { interventionId },
        data: { lastNotifiedEtaAt: input.newEta },
      });
    }
    await this.queue.add(
      'send',
      { notificationId: notification.id },
      {
        jobId: notification.id,
        attempts: SEND_ATTEMPTS,
        backoff: { type: 'exponential', delay: BACKOFF_MS },
        removeOnComplete: true,
      },
    );
    return { status: 'queued', notificationId: notification.id };
  }

  /** Called by the queue processor. Throws on failure so BullMQ retries. */
  async deliver(notificationId: string, finalAttempt: boolean): Promise<void> {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n || n.status !== 'QUEUED') return;
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
      if (finalAttempt) await this.refundQuota(n.interventionId);
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

  async getUsage(businessId: string) {
    const b = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    return {
      quota: b.smsQuotaMonthly,
      used: b.smsUsedThisPeriod,
      remaining: Math.max(0, b.smsQuotaMonthly - b.smsUsedThisPeriod),
    };
  }

  /** Prefilled text + link for copy / native share / `sms:` deep link. */
  async buildShareMessage(interventionId: string, kind: NotificationKind = 'EN_ROUTE') {
    const iv = await this.prisma.intervention.findUnique({
      where: { id: interventionId },
      include: { business: true, customer: true, technician: { include: { user: true } }, trackingSessions: true },
    });
    if (!iv) throw new NotFoundException('intervention_not_found');
    const link = await this.links.issue(interventionId);
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

  private async refundQuota(interventionId: string) {
    const iv = await this.prisma.intervention.findUnique({
      where: { id: interventionId },
      select: { businessId: true },
    });
    if (iv) {
      await this.prisma.business.updateMany({
        where: { id: iv.businessId, smsUsedThisPeriod: { gt: 0 } },
        data: { smsUsedThisPeriod: { decrement: 1 } },
      });
    }
  }
}
