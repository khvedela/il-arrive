import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { ETAStalenessPolicyService } from '../../eta/eta-staleness-policy.service';
import { ROUTING_PROVIDER_TOKEN } from '../../routing/routing.module';
import type { RoutingProvider } from '../../routing/routing.interface';
import { TrackingEventsHub } from './tracking-events.hub';
import { TRACKING_KEY_TTL_S, trackingKeys } from './tracking.keys';

/** Hard cap: at most one routing call per session per minute, shared by every API instance. */
const ETA_CALL_CAP_S = 60;

export interface EtaInput {
  interventionId: string;
  etaComputedAt: Date | null;
  fix: { lat: number; lng: number };
  now: Date;
}

@Injectable()
export class TrackingEtaService {
  private readonly logger = new Logger(TrackingEtaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly policy: ETAStalenessPolicyService,
    private readonly hub: TrackingEventsHub,
    @Inject(ROUTING_PROVIDER_TOKEN) private readonly routing: RoutingProvider,
  ) {}

  /** Applies the §5 policy and, when due, recomputes + persists + pushes the ETA. Returns true if recomputed. */
  async maybeRecompute({ interventionId, etaComputedAt, fix, now }: EtaInput): Promise<boolean> {
    const originRaw = await this.redis.get(trackingKeys.etaOrigin(interventionId));
    const origin = originRaw ? (JSON.parse(originRaw) as { lat: number; lng: number }) : null;
    if (!this.policy.shouldRecompute(etaComputedAt, null, origin?.lat ?? null, origin?.lng ?? null, fix.lat, fix.lng, now)) {
      return false;
    }

    const destination = await this.prisma.intervention.findUnique({
      where: { id: interventionId },
      select: { addressLat: true, addressLng: true },
    });
    if (destination?.addressLat == null || destination.addressLng == null) {
      this.logger.warn(JSON.stringify({ metric: 'eta.skipped', reason: 'no_destination_coordinates', interventionId }));
      return false;
    }

    const claimed = await this.redis.set(trackingKeys.etaLock(interventionId), '1', 'EX', ETA_CALL_CAP_S, 'NX');
    if (!claimed) return false;

    const started = Date.now();
    let route;
    try {
      route = await this.routing.route(fix, { lat: destination.addressLat, lng: destination.addressLng }, { departAt: now });
    } catch (e) {
      // Honest degradation: keep the previous ETA with its own computedAt; never extrapolate.
      this.logger.warn(
        JSON.stringify({ metric: 'routing.failure', interventionId, latencyMs: Date.now() - started, error: e instanceof Error ? e.message : String(e) }),
      );
      return false;
    }
    this.logger.log(JSON.stringify({ metric: 'routing.latency', source: route.source, latencyMs: Date.now() - started }));

    const etaAt = new Date(now.getTime() + route.durationS * 1000);
    const etaSource = route.source === 'fake' ? 'fake' : 'tomtom';
    const stored = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.trackingSession.updateMany({
        where: { interventionId, endedAt: null },
        data: { etaAt, etaComputedAt: now, etaSource },
      });
      // Internal `eta.updated` event: the notifications module consumes this timeline row.
      if (count) {
        await tx.interventionEvent.create({
          data: { interventionId, type: 'intervention.eta.updated', payload: { eta: etaAt.toISOString(), etaSource } },
        });
      }
      return count > 0;
    });
    if (!stored) return false; // session ended while routing; end cleanup owns the keys

    await this.redis.set(trackingKeys.etaOrigin(interventionId), JSON.stringify(fix), 'EX', TRACKING_KEY_TTL_S);
    this.logger.log(JSON.stringify({ metric: 'eta.computed', interventionId, source: etaSource, durationS: route.durationS }));
    await this.hub.publish(interventionId);
    return true;
  }
}
