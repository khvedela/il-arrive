import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { InterventionForPublic, InterventionRepository } from './intervention.repository';
import { hashToken } from './tracking-link.service';

const FINAL_STATE_VISIBLE_MS = 24 * 60 * 60 * 1000;
const STALE_FIX_MS = 120 * 1000;

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
  /** Only while EN_ROUTE. Coordinates are omitted when the last fix is stale. */
  /** LIVE (fix <= 120 s), STALE (older: position hidden, last ETA kept with its timestamp), UNAVAILABLE. */
  locationStatus: 'LIVE' | 'STALE' | 'UNAVAILABLE';
  location?: { lat?: number; lng?: number; status: 'FRESH' | 'STALE'; lastFixAt: string };
  contactPhone: string;
}

@Injectable()
export class PublicTrackingService {
  constructor(private readonly repository: InterventionRepository) {}

  /**
   * Resolves a raw token to the customer-safe projection.
   * Unknown/revoked token -> NotFound; past hard expiry or past the 24 h final-state window -> Gone.
   */
  async getPublicTracking(token: string, now = new Date()): Promise<PublicTrackingProjection> {
    const link = await this.repository.findActiveLinkByHash(hashToken(token));
    if (!link) throw new NotFoundException();

    if (link.expiresAt.getTime() < now.getTime()) throw new GoneException('Ce lien a expiré');

    const intervention = await this.repository.findForPublic(link.interventionId);
    if (!intervention) throw new NotFoundException();

    if (this.isPastFinalStateWindow(intervention, now)) throw new GoneException('Ce lien a expiré');

    return this.project(intervention, now);
  }

  /** Resolves a token to its intervention for SSE subscriptions; same failure modes as the projection. */
  async interventionIdForToken(token: string, now = new Date()): Promise<string> {
    const link = await this.repository.findActiveLinkByHash(hashToken(token));
    if (!link) throw new NotFoundException();
    if (link.expiresAt.getTime() < now.getTime()) throw new GoneException('Ce lien a expiré');
    return link.interventionId;
  }

  private isPastFinalStateWindow(i: InterventionForPublic, now: Date): boolean {
    if (i.status !== 'COMPLETED' && i.status !== 'CANCELLED') return false;
    const endedAt = i.status === 'COMPLETED' ? (i.completedAt ?? i.updatedAt) : i.updatedAt;
    return now.getTime() > endedAt.getTime() + FINAL_STATE_VISIBLE_MS;
  }

  private project(i: InterventionForPublic, now: Date): PublicTrackingProjection {
    const active = i.trackingSessions.find((s) => s.endedAt === null);
    const session = active ?? null;
    const projection: PublicTrackingProjection = {
      businessName: i.business.name,
      businessLogoUrl: i.business.logoUrl ?? undefined,
      businessPhone: i.business.phone,
      technicianFirstName: i.technician?.user.firstName ?? '',
      technicianAvatarUrl: i.technician?.user.avatarUrl ?? undefined,
      status: i.status,
      windowStart: i.windowStart.toISOString(),
      windowEnd: i.windowEnd.toISOString(),
      addressLabel: i.addressLabel,
      contactPhone: i.business.phone,
      locationStatus: 'UNAVAILABLE',
    };

    if ((i.status === 'SCHEDULED' || i.status === 'EN_ROUTE') && i.delayMinutes) {
      projection.delayMinutes = i.delayMinutes;
      projection.delayReason = i.delayReason ?? undefined;
    }

    if (i.status === 'EN_ROUTE' && session) {
      if (session.etaAt) projection.eta = session.etaAt.toISOString();
      if (session.etaComputedAt) projection.etaComputedAt = session.etaComputedAt.toISOString();

      if (session.lastFixAt) {
        const fresh = now.getTime() - session.lastFixAt.getTime() <= STALE_FIX_MS;
        projection.locationStatus = fresh ? 'LIVE' : 'STALE';
        projection.location =
          fresh && session.lastLat !== null && session.lastLng !== null
            ? {
                lat: Number(session.lastLat.toFixed(4)),
                lng: Number(session.lastLng.toFixed(4)),
                status: 'FRESH',
                lastFixAt: session.lastFixAt.toISOString(),
              }
            : { status: 'STALE', lastFixAt: session.lastFixAt.toISOString() };
      }
    }

    return projection;
  }
}
