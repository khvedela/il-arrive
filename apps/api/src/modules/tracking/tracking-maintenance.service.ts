import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { ETAStalenessPolicyService } from '../../eta/eta-staleness-policy.service';
import { TrackingEventsHub } from './tracking-events.hub';
import { TrackingSessionService } from './tracking-session.service';
import { TRACKING_KEY_TTL_S, trackingKeys } from './tracking.keys';

export const SWEEP_EVERY_MS = 30_000;
const STALE_AFTER_MS = 120_000;

export interface SweepResult {
  expired: string[];
  staleNotified: string[];
}

/** Periodic job body (driven by a BullMQ repeatable job): 3 h expiry sweep + stale push. */
@Injectable()
export class TrackingMaintenanceService {
  private readonly logger = new Logger(TrackingMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly policy: ETAStalenessPolicyService,
    private readonly sessions: TrackingSessionService,
    private readonly hub: TrackingEventsHub,
  ) {}

  async sweep(now = new Date()): Promise<SweepResult> {
    const active = await this.prisma.trackingSession.findMany({
      where: { endedAt: null },
      select: { interventionId: true, startedAt: true, lastFixAt: true },
    });

    const expired: string[] = [];
    const staleNotified: string[] = [];
    for (const s of active) {
      if (this.policy.checkSessionExpiry(s.startedAt, s.lastFixAt, now).expired) {
        if (await this.sessions.endActiveSession(s.interventionId, 'expired', now)) expired.push(s.interventionId);
        continue;
      }
      if (s.lastFixAt && now.getTime() - s.lastFixAt.getTime() > STALE_AFTER_MS) {
        // One push per staleness episode; ingestion clears the flag when a fix arrives again.
        const first = await this.redis.set(trackingKeys.staleFlag(s.interventionId), '1', 'EX', TRACKING_KEY_TTL_S, 'NX');
        if (first) {
          staleNotified.push(s.interventionId);
          await this.hub.publish(s.interventionId);
        }
      }
    }

    const live = active.filter((s) => s.lastFixAt && now.getTime() - s.lastFixAt.getTime() <= STALE_AFTER_MS).length;
    this.logger.log(
      JSON.stringify({
        metric: 'tracking.sessions.valid_location',
        active: active.length - expired.length,
        live,
        pct: active.length ? Math.round((live / active.length) * 100) : null,
      }),
    );
    return { expired, staleNotified };
  }
}
