import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { TrackingEventsHub } from './tracking-events.hub';
import { POSITION_RESET, allTrackingKeys } from './tracking.keys';

/**
 * Session lifecycle side effects. The DB part of start/end runs inside the SLA-8 transition
 * transaction (InterventionRepository.applyTransition); this service does what happens after commit
 * (Redis cleanup, push) and owns the non-transition end paths (expiry).
 */
@Injectable()
export class TrackingSessionService {
  private readonly logger = new Logger(TrackingSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly hub: TrackingEventsHub,
  ) {}

  async onSessionStarted(interventionId: string): Promise<void> {
    // A restarted session must not inherit the previous run's throttles or stale flag.
    await this.deleteKeys(interventionId);
    this.logger.log(JSON.stringify({ metric: 'tracking.session.started', interventionId }));
    await this.hub.publish(interventionId);
  }

  async onSessionEnded(interventionId: string, reason = 'transition'): Promise<void> {
    await this.deleteKeys(interventionId);
    this.logger.log(JSON.stringify({ metric: 'tracking.session.ended', interventionId, reason }));
    await this.hub.publish(interventionId);
  }

  /** Ends a still-active session outside a transition (3 h expiry). Returns false when already ended. */
  async endActiveSession(interventionId: string, reason: string, now = new Date()): Promise<boolean> {
    const ended = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.trackingSession.updateMany({
        where: { interventionId, endedAt: null },
        data: { endedAt: now, ...POSITION_RESET },
      });
      if (count) {
        await tx.interventionEvent.create({
          data: { interventionId, type: `tracking.${reason}`, payload: { reason } },
        });
      }
      return count > 0;
    });
    // Cleanup runs even when another path won the race: it is idempotent.
    await this.onSessionEnded(interventionId, reason);
    return ended;
  }

  private async deleteKeys(interventionId: string) {
    await this.redis.del(...allTrackingKeys(interventionId));
  }
}
