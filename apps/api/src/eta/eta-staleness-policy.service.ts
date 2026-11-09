import { Injectable } from '@nestjs/common';
import { ETAStalenessPolicy, FixValidationResult, ETAStatus, SessionExpiry } from './eta-policy.interface';

@Injectable()
export class ETAStalenessPolicyService implements ETAStalenessPolicy {
  private readonly RECOMPUTE_INTERVAL_S = 60;
  private readonly RECOMPUTE_DISTANCE_M = 500;
  private readonly STALENESS_THRESHOLD_S = 120;
  private readonly SESSION_DURATION_H = 3;
  private readonly MAX_ACCURACY_M = 200;

  round(lat: number, lng: number): { lat: number; lng: number } {
    const ROUND_FACTOR = 10000;
    return {
      lat: Math.round(lat * ROUND_FACTOR) / ROUND_FACTOR,
      lng: Math.round(lng * ROUND_FACTOR) / ROUND_FACTOR,
    };
  }

  roundPosition(lat: number, lng: number): { lat: number; lng: number } {
    return this.round(lat, lng);
  }

  validateFix(lat: number, lng: number, accuracy: number, timestamp: Date): FixValidationResult {
    const now = new Date();

    if (accuracy > this.MAX_ACCURACY_M) {
      return { valid: false, reason: `Accuracy too low: ${accuracy}m (max ${this.MAX_ACCURACY_M}m)` };
    }

    if (timestamp > now) {
      return { valid: false, reason: 'Timestamp is in the future' };
    }

    const ageMs = now.getTime() - timestamp.getTime();
    const MAX_AGE_MS = 300000;

    if (ageMs > MAX_AGE_MS) {
      return { valid: false, reason: 'Timestamp too old' };
    }

    return { valid: true };
  }

  shouldRecompute(lastComputedAt: Date | null, lastFixAt: Date | null, lastLat: number | null, lastLng: number | null, currentLat: number, currentLng: number): boolean {
    const now = new Date();

    if (!lastComputedAt) {
      return true;
    }

    const ageS = (now.getTime() - lastComputedAt.getTime()) / 1000;
    if (ageS <= this.RECOMPUTE_INTERVAL_S) {
      return false;
    }

    if (!lastLat || !lastLng || !currentLat || !currentLng) {
      return true;
    }

    const distanceM = this.haversineDistance(lastLat, lastLng, currentLat, currentLng);
    if (distanceM > this.RECOMPUTE_DISTANCE_M) {
      return true;
    }

    return false;
  }

  getStatus(etaAt: Date | null, computedAt: Date | null, lastFixAt: Date | null): ETAStatus {
    const now = new Date();

    if (!lastFixAt) {
      return {
        status: 'UNAVAILABLE',
        etaAt,
        etaSource: computedAt ? 'unknown' : null,
        computedAt,
        lastNotifiedEtaAt: null,
        lastLat: null,
        lastLng: null,
        lastAccuracy: null,
        lastFixAt: null,
      };
    }

    const ageS = (now.getTime() - lastFixAt.getTime()) / 1000;

    if (ageS > this.STALENESS_THRESHOLD_S) {
      return {
        status: 'STALE',
        etaAt,
        etaSource: computedAt ? 'unknown' : null,
        computedAt,
        lastNotifiedEtaAt: null,
        lastLat: null,
        lastLng: null,
        lastAccuracy: null,
        lastFixAt,
      };
    }

    return {
      status: 'LIVE',
      etaAt,
      etaSource: computedAt ? 'routing' : null,
      computedAt,
      lastNotifiedEtaAt: null,
      lastLat: null,
      lastLng: null,
      lastAccuracy: null,
      lastFixAt,
    };
  }

  checkSessionExpiry(startedAt: Date, lastFixAt: Date | null, now: Date): SessionExpiry {
    const durationH = (now.getTime() - startedAt.getTime()) / 3600000;

    if (durationH > this.SESSION_DURATION_H) {
      return {
        expired: true,
        reason: `Session exceeded ${this.SESSION_DURATION_H} hours`,
        endedAt: now,
      };
    }

    return {
      expired: false,
      endedAt: null,
    };
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
  }
}
