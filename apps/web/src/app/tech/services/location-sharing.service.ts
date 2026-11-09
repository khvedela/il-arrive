import { Injectable, inject, signal } from '@angular/core';
import { LocationThrottle, type LocationFix } from './location-throttle';
import { TechApi } from './tech-api.service';

export type SharingState = 'idle' | 'sharing' | 'denied' | 'unsupported';
export type StopReason = 'arrived' | 'complete' | 'cancel' | 'stop_route' | 'user' | 'conflict' | 'logout';

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

/**
 * Foreground-only location sharing, active only while a trip is EN_ROUTE.
 * No background tracking: watching stops when the page is hidden or on any stop condition.
 */
@Injectable({ providedIn: 'root' })
export class LocationSharingService {
  private api = inject(TechApi);
  private throttle = new LocationThrottle();
  private watchId: number | null = null;
  private wakeLock: WakeLockSentinelLike | null = null;
  private interventionId: string | null = null;
  private visibilityHandler = () => {
    if (document.visibilityState === 'hidden' && this.watchId !== null) this.stop('user');
  };

  readonly state = signal<SharingState>('idle');
  readonly lastStopReason = signal<StopReason | null>(null);
  readonly activeInterventionId = () => this.interventionId;

  start(interventionId: string): void {
    this.stop('user', false);
    this.lastStopReason.set(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.state.set('unsupported');
      return;
    }
    this.interventionId = interventionId;
    this.throttle.reset();
    this.state.set('sharing');
    this.watchId = navigator.geolocation.watchPosition(
      pos =>
        this.onFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      err => this.onError(err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    void this.acquireWakeLock();
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  stop(reason: StopReason, markIdle = true): void {
    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
    this.interventionId = null;
    void this.releaseWakeLock();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (markIdle && this.state() === 'sharing') {
      this.state.set('idle');
      this.lastStopReason.set(reason);
    }
  }

  /** Test seam / internal: handle one position fix. */
  async onFix(fix: LocationFix, now: number = Date.now()): Promise<void> {
    const id = this.interventionId;
    if (!id || !this.throttle.shouldSend(fix, now)) return;
    this.throttle.markSent(fix, now);
    const res = await this.api.sendLocation(id, fix);
    if (res === 'conflict' && this.interventionId === id) this.stop('conflict');
  }

  private onError(err: { code: number }): void {
    if (err.code === 1) {
      // PERMISSION_DENIED: continue in status-only mode.
      this.stop('user', false);
      this.state.set('denied');
    }
  }

  private async acquireWakeLock(): Promise<void> {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
      if (wl) {
        const sentinel = await wl.request('screen');
        if (this.watchId === null) void sentinel.release();
        else this.wakeLock = sentinel;
      }
    } catch {
      /* wake lock is best-effort */
    }
  }

  private async releaseWakeLock(): Promise<void> {
    const wl = this.wakeLock;
    this.wakeLock = null;
    try {
      await wl?.release();
    } catch {
      /* ignore */
    }
  }
}
