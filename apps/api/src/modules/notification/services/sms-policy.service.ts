import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { NotificationKind } from '@il-arrive/contracts';

export interface SendSMSParams {
  interventionId: string;
  kind: NotificationKind;
  to: string;
  body: string;
}

export interface NotificationRecord {
  id: string;
  interventionId: string;
  kind: NotificationKind;
  channel: 'SMS';
  to: string;
  body: string;
  idempotencyKey: string;
  status: string;
  attempts: number;
  createdAt: Date;
}

@Injectable()
export class SmsPolicyService {
  private static readonly MAX_SMS_PER_INTERVENTION = 5;

  constructor(private readonly prisma: PrismaService) {}

  async canSendSMS(params: SendSMSParams): Promise<{
    allowed: boolean;
    reason?: string;
    lastNotification?: NotificationRecord;
  }> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        interventionId: params.interventionId,
        kind: params.kind,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (notification) {
      if (notification.attempts >= 3) {
        return {
          allowed: false,
          reason: 'max_attempts_reached',
          lastNotification: notification,
        };
      }

      if (notification.status === 'DELIVERED' || notification.status === 'SENT') {
        const dedupKey = this.generateDedupKey(
          params.interventionId,
          params.kind,
          notification.id,
        );
        if (dedupKey === this.generateDedupKey(params.interventionId, params.kind, notification.id)) {
          return {
            allowed: false,
            reason: 'duplicate',
            lastNotification: notification,
          };
        }
      }
    }

    const smsCount = await this.prisma.notification.count({
      where: {
        interventionId: params.interventionId,
        status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
      },
    });

    if (smsCount >= SmsPolicyService.MAX_SMS_PER_INTERVENTION) {
      return {
        allowed: false,
        reason: 'quota_exceeded',
      };
    }

    return { allowed: true, lastNotification: notification };
  }

  generateDedupKey(interventionId: string, kind: NotificationKind, version: string): string {
    return `${interventionId}:${kind}:${version}`;
  }

  async checkEtaThreshold(
    interventionId: string,
    newEta: Date,
    kind: NotificationKind,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (kind !== 'ETA_UPDATE') {
      return { allowed: true };
    }

    const lastNotification = await this.prisma.notification.findFirst({
      where: {
        interventionId,
        kind: 'EN_ROUTE',
        status: { in: ['SENT', 'DELIVERED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastNotification) {
      return { allowed: true };
    }

    const now = new Date();
    const etaDelta = Math.abs(newEta.getTime() - lastNotification.createdAt.getTime());
    const minutesSinceLastSms = (now.getTime() - lastNotification.createdAt.getTime()) / (1000 * 60);

    if (etaDelta < 15 * 60 * 1000 || minutesSinceLastSms < 20) {
      return {
        allowed: false,
        reason: 'eta_threshold_not_met',
      };
    }

    return { allowed: true };
  }

  async getBusinessQuota(businessId: string): Promise<{
    quota: number;
    used: number;
    remaining: number;
  }> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { smsQuotaMonthly: true, smsUsedThisPeriod: true },
    });

    if (!business) {
      return { quota: 0, used: 0, remaining: 0 };
    }

    return {
      quota: business.smsQuotaMonthly,
      used: business.smsUsedThisPeriod,
      remaining: business.smsQuotaMonthly - business.smsUsedThisPeriod,
    };
  }

  async checkBusinessQuota(
    businessId: string,
    additionalCount: number = 1,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const { quota, remaining } = await this.getBusinessQuota(businessId);

    if (remaining < additionalCount) {
      return {
        allowed: false,
        reason: 'business_quota_exceeded',
      };
    }

    return { allowed: true };
  }
}
