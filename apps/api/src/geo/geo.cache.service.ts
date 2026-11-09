import { Injectable } from '@nestjs/common';
import { GeocodingResponse } from './geo.controller.interface';

export interface CacheEntry {
  results: GeocodingResponse[];
  createdAt: number;
}

@Injectable()
export class GeoCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly ttlMs = 600000;

  set(key: string, results: GeocodingResponse[]): void {
    this.cache.set(key, {
      results,
      createdAt: Date.now(),
    });
  }

  get(key: string): GeocodingResponse[] | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.results;
  }

  clear(): void {
    this.cache.clear();
  }
}
