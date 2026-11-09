export interface LocationFix {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export const MAX_ACCURACY_M = 200;
export const MIN_INTERVAL_MS = 20_000;
export const MIN_DISTANCE_M = 150;

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Decides which GPS fixes are sent: ARCHITECTURE §5 (≤ every 20 s or > 150 m moved, drop accuracy > 200 m). */
export class LocationThrottle {
  private last: { fix: LocationFix; sentAt: number } | null = null;

  shouldSend(fix: LocationFix, now: number): boolean {
    if (!(fix.accuracy <= MAX_ACCURACY_M)) return false;
    if (!this.last) return true;
    if (now - this.last.sentAt >= MIN_INTERVAL_MS) return true;
    return distanceMeters(this.last.fix, fix) > MIN_DISTANCE_M;
  }

  markSent(fix: LocationFix, now: number): void {
    this.last = { fix, sentAt: now };
  }

  reset(): void {
    this.last = null;
  }
}
