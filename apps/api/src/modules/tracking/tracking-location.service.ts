import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { ETAStalenessPolicyService } from '../../eta/eta-staleness-policy.service';
import { TrackingEtaService } from './tracking-eta.service';
import { TrackingEventsHub } from './tracking-events.hub';
import { TRACKING_KEY_TTL_S, trackingKeys } from './tracking.keys';

/** 1 accepted fix every 5 s per session. */
export const FIX_MIN_INTERVAL_MS = 5000;

export interface LocationInput {
  lat: unknown;
  lng: unknown;
  accuracy: unknown;
  timestamp: unknown;
}

export interface LocationResult {
  accepted: boolean;
  etaRecomputed: boolean;
}

@Injectable()
export class TrackingLocationService {
  private readonly logger = new Logger(TrackingLocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly policy: ETAStalenessPolicyService,
    private readonly eta: TrackingEtaService,
    private readonly hub: TrackingEventsHub,
  ) {}

  /**
   * Stores the LAST fix only (Postgres + Redis, no history). Assignee only; 409 unless the
   * intervention is EN_ROUTE with an active session, so the client stops watching its position.
   */
  async ingest(businessId: string, userId: string, interventionId: string, input: LocationInput, now = new Date()): Promise<LocationResult> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, businessId, isTechnician: true },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('Not a technician of this business');

    const intervention = await this.prisma.intervention.findFirst({
      where: { id: interventionId, businessId },
      select: { status: true, technicianMembershipId: true, trackingSessions: { where: { endedAt: null }, select: { id: true, etaComputedAt: true } } },
    });
    if (!intervention) throw new NotFoundException(`Intervention ${interventionId} not found`);
    if (intervention.technicianMembershipId !== membership.id) {
      throw new ForbiddenException(`Intervention ${interventionId} is not assigned to you`);
    }
    const session = intervention.trackingSessions[0];
    if (intervention.status !== 'EN_ROUTE' || !session) {
      throw new ConflictException('No active tracking session: stop sending location');
    }

    const { lat, lng, accuracy } = input;
    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof accuracy !== 'number') {
      throw new BadRequestException('lat, lng and accuracy must be numbers');
    }
    const timestamp = new Date(typeof input.timestamp === 'string' || typeof input.timestamp === 'number' ? input.timestamp : NaN);
    const verdict = this.policy.validateFix(lat, lng, accuracy, timestamp, now);
    if (!verdict.valid) throw new BadRequestException(verdict.reason);

    const slot = await this.redis.set(trackingKeys.rateLimit(interventionId), '1', 'PX', FIX_MIN_INTERVAL_MS, 'NX');
    if (!slot) throw new HttpException('One location fix every 5 seconds', HttpStatus.TOO_MANY_REQUESTS);

    // Never let an out-of-order fix overwrite a newer one; guard on the session still being active.
    const { count } = await this.prisma.trackingSession.updateMany({
      where: { interventionId, endedAt: null, OR: [{ lastFixAt: null }, { lastFixAt: { lt: timestamp } }] },
      data: { lastLat: lat, lastLng: lng, lastAccuracy: accuracy, lastFixAt: timestamp },
    });
    if (!count) {
      const stillActive = await this.prisma.trackingSession.count({ where: { interventionId, endedAt: null } });
      if (!stillActive) throw new ConflictException('No active tracking session: stop sending location');
      return { accepted: false, etaRecomputed: false };
    }

    await this.redis.set(
      trackingKeys.fix(interventionId),
      JSON.stringify({ lat, lng, accuracy, fixAt: timestamp.toISOString() }),
      'EX',
      TRACKING_KEY_TTL_S,
    );
    // The session may have ended between the write and the Redis set: never leave a position behind.
    if (!(await this.prisma.trackingSession.count({ where: { interventionId, endedAt: null } }))) {
      await this.redis.del(trackingKeys.fix(interventionId));
      throw new ConflictException('No active tracking session: stop sending location');
    }
    await this.redis.del(trackingKeys.staleFlag(interventionId));

    const etaRecomputed = await this.eta
      .maybeRecompute({ interventionId, etaComputedAt: session.etaComputedAt, fix: { lat, lng }, now })
      .catch((e: unknown) => {
        this.logger.error(`eta recompute failed: ${e instanceof Error ? e.message : e}`);
        return false;
      });
    // The new position itself is a projection change (customer map moves).
    await this.hub.publish(interventionId);
    return { accepted: true, etaRecomputed };
  }
}
