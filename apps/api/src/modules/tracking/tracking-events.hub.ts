import { EventEmitter } from 'node:events';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RedisService } from '../../common/redis.service';
import { TRACKING_CHANNEL } from './tracking.keys';

/**
 * "The projection of this intervention changed" fan-out. Redis pub/sub carries it between the
 * API and worker processes; SSE connections subscribe per intervention and re-read the projection.
 */
@Injectable()
export class TrackingEventsHub implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingEventsHub.name);
  private readonly emitter = new EventEmitter();
  private subscriber?: Redis;

  constructor(private readonly redis: RedisService) {
    this.emitter.setMaxListeners(0);
  }

  async onModuleInit() {
    this.subscriber = this.redis.duplicate();
    this.subscriber.on('message', (_channel: string, interventionId: string) => this.emitter.emit(interventionId));
    await this.subscriber.subscribe(TRACKING_CHANNEL);
  }

  async onModuleDestroy() {
    this.emitter.removeAllListeners();
    await this.subscriber?.quit().catch(() => undefined);
  }

  async publish(interventionId: string): Promise<void> {
    try {
      await this.redis.publish(TRACKING_CHANNEL, interventionId);
    } catch (e) {
      this.logger.warn(`tracking publish failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  subscribe(interventionId: string, listener: () => void): () => void {
    this.emitter.on(interventionId, listener);
    return () => this.emitter.off(interventionId, listener);
  }
}
