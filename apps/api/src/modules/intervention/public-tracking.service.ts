import { Injectable, NotFoundException, GoneException } from '@nestjs/common';
import { InterventionRepository } from './intervention.repository';

export interface PublicTrackingProjection {
  businessName: string;
  businessLogoUrl?: string;
  businessPhone: string;
  technicianFirstName: string;
  technicianAvatarUrl?: string;
  status: string;
  windowStart: string;
  windowEnd: string;
  addressLabel: string;
  eta?: string;
  etaComputedAt?: string;
  delayMinutes?: number;
  delayReason?: string;
  location?: {
    lat: number;
    lng: number;
    status: string;
    lastFixAt: string;
  };
  contactPhone: string;
}

@Injectable()
export class PublicTrackingService {
  constructor(private readonly interventionRepository: InterventionRepository) {}

  async getPublicTracking(token: string): Promise<PublicTrackingProjection | null> {
    const result = await this.interventionRepository.findTrackingLinkByTokenHash(
      this.hashToken(token),
    );

    if (!result) {
      return null;
    }

    const { intervention } = result;

    if (this.is_expired(intervention)) {
      if (this.should_show_final_state(intervention)) {
        return this.buildPublicProjection(intervention);
      }
      throw new GoneException('Tracking link has expired');
    }

    return this.buildPublicProjection(intervention);
  }

  async getPublicTrackingTimeline(token: string): Promise<any[]> {
    const result = await this.interventionRepository.findTrackingLinkByTokenHash(
      this.hashToken(token),
    );

    if (!result) {
      throw new NotFoundException('Tracking link not found');
    }

    const { intervention } = result;

    if (this.is_expired(intervention)) {
      throw new NotFoundException('Tracking link has expired');
    }

    const timeline = await this.interventionRepository.findInterventionEvent(
      intervention.id,
      intervention.businessId,
    );

    return timeline.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
      payload: typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload,
    }));
  }

  private hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private buildPublicProjection(intervention: any): PublicTrackingProjection {
    const projection: PublicTrackingProjection = {
      businessName: intervention.business?.name || '',
      businessLogoUrl: intervention.business?.logoUrl,
      businessPhone: intervention.business?.phone || '',
      technicianFirstName: intervention.technicianMember?.user?.firstName || '',
      technicianAvatarUrl: intervention.technicianMember?.user?.avatarUrl,
      status: intervention.status,
      windowStart: intervention.windowStart.toISOString(),
      windowEnd: intervention.windowEnd.toISOString(),
      addressLabel: intervention.addressLabel,
      contactPhone: intervention.customer?.phone || '',
    };

    if (intervention.delayMinutes) {
      projection.delayMinutes = intervention.delayMinutes;
      projection.delayReason = intervention.delayReason;
    }

    if (intervention.etaComputedAt) {
      projection.eta = intervention.etaComputedAt.toISOString();
      projection.etaComputedAt = intervention.etaComputedAt.toISOString();
    }

    if (
      intervention.status === 'EN_ROUTE' &&
      intervention.locationLat &&
      intervention.locationLng
    ) {
      const now = new Date();
      const lastFixAt = intervention.locationLastFixAt || intervention.updatedAt;
      const isStale = this.is_location_stale(lastFixAt);

      projection.location = {
        lat: Number(intervention.locationLat.toFixed(4)),
        lng: Number(intervention.locationLng.toFixed(4)),
        status: isStale ? 'STALE' : 'FRESH',
        lastFixAt: lastFixAt.toISOString(),
      };
    }

    return projection;
  }

  private is_location_stale(lastFixAt: Date): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - lastFixAt.getTime()) / (1000 * 60);
    return diffMinutes > 120;
  }

  private is_expired(intervention: any): boolean {
    const windowEnd = new Date(intervention.windowEnd);
    const now = new Date();
    const expiryOffset = intervention.status === 'COMPLETED' || intervention.status === 'CANCELLED' ? 48 : 41;
    return now.getTime() > new Date(windowEnd.getTime() + expiryOffset * 60 * 60 * 1000).getTime();
  }

  private should_show_final_state(intervention: any): boolean {
    const now = new Date();
    const completeDate = intervention.completedAt || new Date(intervention.windowEnd);
    const finalStateWindow = new Date(completeDate.getTime() + 24 * 60 * 60 * 1000);
    return now.getTime() < finalStateWindow.getTime();
  }
}
