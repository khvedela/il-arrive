import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { InterventionStatus, NotificationKind, NotificationChannel } from '@il-arrive/contracts';
import { ConsoleSmsProvider } from '../notification/providers/console-sms.provider';
import { NotificationService } from '../notification/services/notification.service';
import { PhoneFormatterService } from '../notification/services/phone-formatter.service';
import { SmsTemplatesService } from '../notification/services/sms-templates.service';
import { Notification } from '@prisma/client';

export interface NotifyResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ShareMessageResponse {
  text: string;
  link: string;
  smsUri: string;
  trackingUrl: string;
  phone?: string;
}

@Injectable()
export class InterventionService {
  private readonly logger = new Logger(InterventionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consoleSmsProvider: ConsoleSmsProvider,
    private readonly notificationService: NotificationService,
    private readonly phoneFormatter: PhoneFormatterService,
    private readonly smsTemplates: SmsTemplatesService,
  ) {}

  async notify(interventionId: string, kind: string, to?: string): Promise<NotifyResponse> {
    const intervention = await this.prisma.intervention.findUnique({
      where: { id: interventionId },
      include: {
        business: true,
        customer: true,
        technician: { include: { user: true } },
      },
    });

    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    const notificationKind = this.normalizeKind(kind);
    if (!notificationKind) {
      return { success: false, error: 'invalid_kind' };
    }

    let toPhone = to;
    if (!toPhone) {
      if (intervention.technician?.user?.phone) {
        toPhone = intervention.technician.user.phone;
      } else if (intervention.customer?.phone) {
        toPhone = intervention.customer.phone;
      } else {
        return { success: false, error: 'no_phone_number' };
      }
    }

    const phoneResult = this.phoneFormatter.parseAndFormat(toPhone);
    if (!phoneResult.isValid) {
      return { success: false, error: 'invalid_phone' };
    }

    if (notificationKind === 'EN_ROUTE' && intervention.status !== 'EN_ROUTE') {
      return { success: false, error: 'invalid_status_for_en_route' };
    }

    const trackLink = await this.getTrackingLink(interventionId);
    if (!trackLink) {
      return { success: false, error: 'no_tracking_link' };
    }

    const trackingUrl = `${process.env.TRACK_HOST || 'https://track.il-arrive.fr'}/t/${trackLink}`;

    const templateParams = this.getTemplateParams(intervention, notificationKind, trackingUrl);
    const templateResult = this.smsTemplates.getTemplate(notificationKind, templateParams);

    return this.notificationService.sendNotification({
      interventionId,
      kind: notificationKind,
      to: phoneResult.e164,
      body: templateResult.body,
      idempotencyKey: `${interventionId}:${notificationKind}:1`,
      businessId: intervention.businessId,
    });
  }

  async getShareMessage(interventionId: string, to?: string): Promise<ShareMessageResponse> {
    const intervention = await this.prisma.intervention.findUnique({
      where: { id: interventionId },
      include: {
        business: true,
        customer: true,
        technician: { include: { user: true } },
        trackingLinks: { select: { tokenHash: true }, take: 1 },
      },
    });

    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    const trackLink = intervention.trackingLinks[0]?.tokenHash;
    if (!trackLink) {
      throw new NotFoundException(`Tracking link not found for intervention ${interventionId}`);
    }

    const trackingUrl = `${process.env.TRACK_HOST || 'https://track.il-arrive.fr'}/t/${trackLink}`;

    let phone = to;
    if (!phone) {
      if (intervention.technician?.user?.phone) {
        phone = intervention.technician.user.phone;
      } else if (intervention.customer?.phone) {
        phone = intervention.customer.phone;
      }
    }

    const templateParams = this.getTemplateParams(intervention, 'EN_ROUTE', trackingUrl);
    const templateResult = this.smsTemplates.getTemplate('EN_ROUTE', templateParams);

    let smsUri = '';
    if (phone) {
      const phoneResult = this.phoneFormatter.parseAndFormat(phone);
      if (phoneResult.isValid) {
        const encodedText = encodeURIComponent(templateResult.body);
        smsUri = `sms:${phoneResult.e164}?body=${encodedText}`;
      }
    }

    return {
      text: templateResult.body,
      link: trackingUrl,
      smsUri,
      trackingUrl,
      phone: phone || undefined,
    };
  }

  private normalizeKind(kind: string): NotificationKind | null {
    const normalized = kind.toUpperCase();
    if (Object.values(NotificationKind).includes(normalized as NotificationKind)) {
      return normalized as NotificationKind;
    }
    return null;
  }

  private getTemplateParams(
    intervention: any,
    kind: NotificationKind,
    trackingUrl: string,
  ): any {
    const params: any = {
      businessName: intervention.business.name,
      trackingLink: trackingUrl,
    };

    if (intervention.technician?.user?.firstName) {
      params.technicianFirstName = intervention.technician.user.firstName;
    }

    if (intervention.addressLabel) {
      params.interventionAddress = intervention.addressLabel;
    }

    if (intervention.delayMinutes) {
      params.delayMinutes = intervention.delayMinutes;
    }

    if (intervention.eta) {
      params.eta = new Date(intervention.eta);
    }

    return params;
  }

  private async getTrackingLink(interventionId: string): Promise<string | null> {
    const intervention = await this.prisma.intervention.findUnique({
      where: { id: interventionId },
      include: { trackingLinks: { select: { tokenHash: true }, take: 1 } },
    });

    return intervention?.trackingLinks[0]?.tokenHash || null;
  }

  async getEnRouteNotification(interventionId: string, to: string): Promise<NotifyResponse> {
    const intervention = await this.prisma.intervention.findUnique({
      where: { id: interventionId },
      include: { business: true },
    });

    if (!intervention) {
      return { success: false, error: 'intervention_not_found' };
    }

    const trackLink = await this.getTrackingLink(interventionId);
    if (!trackLink) {
      return { success: false, error: 'no_tracking_link' };
    }

    const trackingUrl = `${process.env.TRACK_HOST || 'https://track.il-arrive.fr'}/t/${trackLink}`;

    const templateParams = {
      businessName: intervention.business.name,
      technicianFirstName: intervention.technician?.user?.firstName || 'le technicien',
      eta: intervention.ETA ? new Date(intervention.ETA) : undefined,
      trackingLink: trackingUrl,
      interventionAddress: intervention.addressLabel,
      delayMinutes: intervention.delayMinutes,
    };

    const templateResult = this.smsTemplates.getTemplate('EN_ROUTE', templateParams);

    const phoneResult = this.phoneFormatter.parseAndFormat(to);
    if (!phoneResult.isValid) {
      return { success: false, error: 'invalid_phone' };
    }

    return this.notificationService.sendNotification({
      interventionId,
      kind: 'EN_ROUTE',
      to: phoneResult.e164,
      body: templateResult.body,
      idempotencyKey: `${interventionId}:EN_ROUTE:1`,
      businessId: intervention.businessId,
    });
  }
}
