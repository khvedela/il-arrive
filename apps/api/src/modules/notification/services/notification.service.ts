import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { SmsProvider, NotificationKind, InterventionStatus } from '@il-arrive/contracts';
import { SmsPolicyService } from './sms-policy.service';
import { SmsTemplatesService } from './sms-templates.service';
import { PhoneFormatterService } from './phone-formatter.service';

export interface NotificationData {
  interventionId: string;
  kind: NotificationKind;
  to: string;
  body: string;
  idempotencyKey: string;
  businessId: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsProvider: SmsProvider,
    private readonly smsPolicy: SmsPolicyService,
    private readonly smsTemplates: SmsTemplatesService,
    private readonly phoneFormatter: PhoneFormatterService,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  async sendNotification(data: NotificationData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { interventionId, kind, to, body, idempotencyKey, businessId } = data;

    this.logger.log(`Processing notification: interventionId=${interventionId}, kind=${kind}`);

    const phoneResult = this.phoneFormatter.parseAndFormat(to);
    if (!phoneResult.isValid) {
      this.logger.error(`Invalid phone number: ${to}`);
      return { success: false, error: 'invalid_phone' };
    }

    const canSendResult = await this.smsPolicy.canSendSMS({ interventionId, kind, to, body });
    if (!canSendResult.allowed) {
      this.logger.log(`Notification blocked: reason=${canSendResult.reason}`);
      if (canSendResult.reason === 'quota_exceeded' || canSendResult.reason === 'business_quota_exceeded') {
        await this.createNotificationRecord({ ...data, status: 'FAILED', error: canSendResult.reason });
      }
      return { success: false, error: canSendResult.reason };
    }

    const etaResult = await this.smsPolicy.checkEtaThreshold(interventionId, new Date(), kind);
    if (!etaResult.allowed) {
      this.logger.log(`ETA threshold not met: reason=${etaResult.reason}`);
      return { success: false, error: etaResult.reason };
    }

    const quotaResult = await this.smsPolicy.checkBusinessQuota(businessId);
    if (!quotaResult.allowed) {
      this.logger.warn(`Business quota exceeded: businessId=${businessId}`);
      await this.createNotificationRecord({ ...data, status: 'FAILED', error: quotaResult.reason });
      return { success: false, error: quotaResult.reason };
    }

    const notification = await this.createNotificationRecord({ ...data, status: 'QUEUED' });

    try {
      const job = await this.notificationQueue.add(
        'send-sms',
        {
          notificationId: notification.id,
          providerMessageId: notification.providerMessageId,
          to: phoneResult.e164,
          body,
          idempotencyKey,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      );

      this.logger.log(`Notification queued: jobId=${job.id}, notificationId=${notification.id}`);
      return { success: true, messageId: job.id };
    } catch (error) {
      this.logger.error(`Failed to queue notification: ${error instanceof Error ? error.message : String(error)}`);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED', error: error instanceof Error ? error.message : String(error) },
      });
      return { success: false, error: 'queue_error' };
    }
  }

  async createNotificationRecord(data: {
    interventionId: string;
    kind: NotificationKind;
    to: string;
    body: string;
    idempotencyKey: string;
    status: string;
    error?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        interventionId: data.interventionId,
        kind: data.kind,
        channel: 'SMS',
        to: data.to,
        body: data.body,
        idempotencyKey: data.idempotencyKey,
        provider: 'ConsoleSmsProvider',
        providerMessageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        status: data.status,
        error: data.error,
        attempts: 0,
      },
    });
  }

  async handleSendSms(job: {
    data: {
      notificationId: string;
      providerMessageId: string;
      to: string;
      body: string;
      idempotencyKey: string;
    };
    id: string;
  }) {
    const { notificationId, providerMessageId, to, body, idempotencyKey } = job.data;

    try {
      await this.smsProvider.send(to, body, idempotencyKey);

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'SENT', attempts: { increment: 1 } },
      });

      this.logger.log(`SMS sent successfully: notificationId=${notificationId}`);
    } catch (error) {
      const attempts = (await this.prisma.notification.findUnique({ where: { id: notificationId } }))?.attempts || 0;

      if (attempts >= 3) {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: { status: 'FAILED', error: error instanceof Error ? error.message : String(error) },
        });

        this.logger.error(`SMS failed after 3 attempts: notificationId=${notificationId}`);
      } else {
        throw error;
      }
    }
  }

  async handleMarkDelivered(providerMessageId: string) {
    await this.smsProvider.markDelivered(providerMessageId);

    const notification = await this.prisma.notification.findFirst({
      where: { providerMessageId },
    });

    if (notification) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'DELIVERED' },
      });
      this.logger.log(`Marked delivered: providerMessageId=${providerMessageId}`);
    }
  }

  async handleMarkFailed(providerMessageId: string, error: string) {
    await this.smsProvider.markFailed(providerMessageId, error);

    const notification = await this.prisma.notification.findFirst({
      where: { providerMessageId },
    });

    if (notification) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED', error },
      });
      this.logger.error(`Marked failed: providerMessageId=${providerMessageId}, error=${error}`);
    }
  }

  async sendEnRouteNotification(interventionId: string, to: string, businessId: string, eta?: Date): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const intervention = await this.prisma.intervention.findUnique({
      where: { id: interventionId },
      select: {
        business: { select: { name: true } },
        technician: { select: { user: { select: { firstName: true } } } },
        trackingLinks: { select: { tokenHash: true }, take: 1 },
        addressLabel: true,
      },
    });

    if (!intervention) {
      return { success: false, error: 'intervention_not_found' };
    }

    const trackingLink = intervention.trackingLinks[0]?.tokenHash || '';
    const trackingUrl = `${process.env.TRACK_HOST || 'https://track.il-arrive.fr'}/t/${trackingLink}`;

    const templateResult = this.smsTemplates.getTemplate('EN_ROUTE', {
      businessName: intervention.business.name,
      technicianFirstName: intervention.technician?.user?.firstName || 'le technicien',
      eta,
      trackingLink: trackingUrl,
    });

    return this.sendNotification({
      interventionId,
      kind: 'EN_ROUTE',
      to,
      body: templateResult.body,
      idempotencyKey: `${interventionId}:EN_ROUTE:1`,
      businessId,
    });
  }
}
