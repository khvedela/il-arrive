import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timer, mergeMap, firstValueFrom } from 'rxjs';
import type { PublicTrackingProjection } from '@il-arrive/contracts';
import { mockFixtures, tokenFixtureMap } from '../data/mock-fixtures';

/**
 * TrackingApi — fetches and subscribes to public tracking data.
 *
 * Uses a MOCK_MODE flag to return mock fixtures for development/testing.
 * In production, calls the real API endpoints.
 *
 * The service is designed to be replaced with real API calls later (SLA-9).
 */

const API_BASE = '/api/public/track';

@Injectable({ providedIn: 'root' })
export class TrackingApi {
  private http = inject(HttpClient);

  /**
   * Fetch the full tracking projection for a given token.
   * Returns mock data when MOCK_MODE=true, real API otherwise.
   */
  fetchProjection(token: string): Observable<PublicTrackingProjection> {
    if (this.isMockMode()) {
      return this.mockFetch(token);
    }
    return this.http.get<PublicTrackingProjection>(`${API_BASE}/${token}`);
  }

  /**
   * Subscribe to SSE events for live updates.
   * Returns mock SSE-like events when MOCK_MODE=true.
   */
  subscribeToEvents(token: string): Observable<MessageEvent> {
    if (this.isMockMode()) {
      return this.mockSubscribe(token);
    }
    return this.fetchSSE(`${API_BASE}/${token}/events`);
  }

  // -------------------------------------------------------------------------
  // Mock implementations
  // -------------------------------------------------------------------------

  private isMockMode(): boolean {
    return typeof window !== 'undefined' && window.location.search.includes('mock=1');
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

  private mockSubscribe(_token: string): Observable<MessageEvent> {
    // No mock SSE events by default — tests trigger updates manually
    return new Observable();
  }

  // -------------------------------------------------------------------------
  // Real SSE implementation (used when mock=1 is not present)
  // -------------------------------------------------------------------------

  private fetchSSE(url: string): Observable<MessageEvent> {
    return new Observable((observer) => {
      const eventSource = new EventSource(url);

      eventSource.onmessage = (event: MessageEvent) => {
        observer.next(event);
      };

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
