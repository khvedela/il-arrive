import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { GeocodingResponse } from './geo.controller.interface';

const TTL_S = 600;
const RATE_WINDOW_S = 60;
export const GEO_RATE_LIMIT = 30;

/** Redis-backed geocoding cache + per-user fixed-window rate limit. Redis outages degrade to "no cache". */
@Injectable()
export class GeoCacheService {
  private readonly logger = new Logger(GeoCacheService.name);

  constructor(private readonly redis: RedisService) {}

  private key(query: string): string {
    return `geo:search:${createHash('sha1').update(query.trim().toLowerCase()).digest('hex')}`;
  }

  async get(query: string): Promise<GeocodingResponse[] | undefined> {
    try {
      const raw = await this.redis.get(this.key(query));
      return raw ? (JSON.parse(raw) as GeocodingResponse[]) : undefined;
    } catch (e) {
      this.logger.warn(`geo cache read failed: ${e instanceof Error ? e.message : e}`);
      return undefined;
    }
  }

  async set(query: string, results: GeocodingResponse[]): Promise<void> {
    try {
      await this.redis.set(this.key(query), JSON.stringify(results), 'EX', TTL_S);
    } catch (e) {
      this.logger.warn(`geo cache write failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  /** Returns false once the caller exceeded GEO_RATE_LIMIT requests in the current minute. */
  async allow(userId: string): Promise<boolean> {
    try {
      const k = `geo:rl:${userId}:${Math.floor(Date.now() / (RATE_WINDOW_S * 1000))}`;
      const n = await this.redis.incr(k);
      if (n === 1) await this.redis.expire(k, RATE_WINDOW_S);
      return n <= GEO_RATE_LIMIT;
    } catch {
      return true;
    }
  }
}
