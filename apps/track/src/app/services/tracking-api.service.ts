import { Injectable, inject, isDevMode } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timer, mergeMap, map } from 'rxjs';
import type { PublicTrackingProjection } from '@il-arrive/contracts';
import { normalizeProjection } from './normalize-projection';
import { mockFixtures, tokenFixtureMap } from '../data/mock-fixtures';

/**
 * TrackingApi — fetches and subscribes to public tracking data.
 *
 * Calls the real API on every host. Fixtures are returned only in dev builds
 * with an explicit ?mock=1.
 *
 * The service is designed to be replaced with real API calls later (SLA-9).
 */

const API_BASE = '/api/public/track';

@Injectable({ providedIn: 'root' })
export class TrackingApi {
  private http = inject(HttpClient);

  /**
   * Fetch the full tracking projection for a given token.
   * Returns mock data only with the explicit dev opt-in.
   */
  fetchProjection(token: string): Observable<PublicTrackingProjection> {
    if (this.isMockMode()) {
      return this.mockFetch(token);
    }
    return this.http
      .get<PublicTrackingProjection>(`${API_BASE}/${token}`)
      .pipe(map(normalizeProjection));
  }

  /**
   * Subscribe to SSE events for live updates.
   * Returns mock SSE-like events only with the explicit dev opt-in.
   */
  subscribeToEvents(token: string): Observable<MessageEvent> {
    if (this.isMockMode()) {
      return this.mockSubscribe();
    }
    return this.fetchSSE(`${API_BASE}/${token}/events`);
  }

  // -------------------------------------------------------------------------
  // Mock implementations
  // -------------------------------------------------------------------------

  private isMockMode(): boolean {
    // Real HTTP/SSE is the default on every host (including localhost).
    // Fixtures are an explicit, development-build-only opt-in via ?mock=1.
    if (typeof window === 'undefined' || !isDevMode()) return false;
    return new URLSearchParams(window.location.search).get('mock') === '1';
  }

  private mockFetch(token: string): Observable<PublicTrackingProjection> {
    const fixtureKey = tokenFixtureMap[token];
    if (!fixtureKey) {
      // Simulate 404 for unknown tokens
      return throwError(() => ({ status: 404, statusText: 'Not Found' } as HttpErrorResponse));
    }

    // Simulate network delay
    return timer(300).pipe(
      mergeMap(() => of(mockFixtures[fixtureKey])),
    );
  }

  private mockSubscribe(): Observable<MessageEvent> {
    // No mock SSE events by default — tests trigger updates manually
    return new Observable();
  }

  // -------------------------------------------------------------------------
  // Real SSE implementation (used when mock=1 is not present)
  // -------------------------------------------------------------------------

  private fetchSSE(url: string): Observable<MessageEvent> {
    return new Observable((observer) => {
      const eventSource = new EventSource(url);

      // The API emits named events: `projection` (full payload) and `session_end`.
      const emit = (payload: unknown) =>
        observer.next(new MessageEvent('message', { data: JSON.stringify(payload) }));
      eventSource.addEventListener('projection', (event) => {
        const wire = JSON.parse((event as MessageEvent).data) as PublicTrackingProjection;
        emit({ event: 'projection', data: normalizeProjection(wire) });
      });
      eventSource.addEventListener('session_end', () => emit({ event: 'session_end', data: {} }));

      eventSource.onerror = (error: Event) => {
        // SSE reconnects automatically; report to observer for refetch
        observer.error(error);
      };

      return () => {
        eventSource.close();
      };
    });
  }
}
