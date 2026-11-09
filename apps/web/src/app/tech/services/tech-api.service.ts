import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { InterventionStatus as IS } from '@il-arrive/contracts/enums';
import type { InterventionStatus } from '@il-arrive/contracts';
import type { TechIntervention, TechTodayResponse } from '../models/intervention';
import { firstValueFrom, of, type Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

/** Actions a technician can perform. The API has no technician "cancel": only dispatchers cancel. */
export type TechAction = 'en_route' | 'arrived' | 'complete' | 'stop_route';

export const ACTION_TO_STATUS: Record<TechAction, InterventionStatus> = {
  en_route: IS.EN_ROUTE,
  arrived: IS.ARRIVED,
  complete: IS.COMPLETED,
  stop_route: IS.SCHEDULED,
};

export const VALID_TRANSITIONS: Record<InterventionStatus, TechAction[]> = {
  [IS.SCHEDULED]: ['en_route'],
  [IS.EN_ROUTE]: ['arrived', 'stop_route'],
  [IS.ARRIVED]: ['complete'],
  [IS.COMPLETED]: [],
  [IS.CANCELLED]: [],
};

const ACTION_PATH: Record<TechAction, string> = {
  en_route: 'en-route',
  arrived: 'arrived',
  complete: 'complete',
  stop_route: 'stop',
};

const API_URL = '/api/tech/interventions';

export interface ActionResult {
  intervention: TechIntervention | null;
  success: boolean;
  optimistic: TechIntervention | null;
  rolledBack: boolean;
  error?: unknown;
}

/** Raw shapes returned by the API (Prisma rows, dates as ISO strings). */
export interface ApiIntervention {
  id: string;
  customerId: string;
  addressLabel: string;
  addressLat: number | null;
  addressLng: number | null;
  scheduledDate: string;
  windowStart: string;
  windowEnd: string;
  description?: string | null;
  internalNotes?: string | null;
  status: InterventionStatus;
  delayMinutes?: number | null;
  delayReason?: string | null;
  customer?: { id: string; name: string; phone: string } | null;
}

export interface ApiTodayResponse {
  date: string;
  interventions: ApiIntervention[];
}

export interface ApiDetailResponse {
  intervention: ApiIntervention;
  customer: { id: string; name: string; phone: string } | null;
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function toTechIntervention(row: ApiIntervention, customer = row.customer ?? null): TechIntervention {
  const windowEnd = new Date(row.windowEnd);
  const mapped: TechIntervention = {
    id: row.id,
    customerId: row.customerId,
    customerName: customer?.name ?? '',
    customerPhone: customer?.phone ?? '',
    addressLabel: row.addressLabel,
    addressLat: row.addressLat,
    addressLng: row.addressLng,
    lat: row.addressLat,
    lng: row.addressLng,
    scheduledDate: row.scheduledDate.split('T')[0],
    windowStart: hhmm(new Date(row.windowStart)),
    windowEnd: hhmm(windowEnd),
    status: row.status,
  };
  if (row.description) mapped.description = row.description;
  if (row.internalNotes) mapped.internalNotes = row.internalNotes;
  if (row.delayMinutes) {
    mapped.delayMinutes = row.delayMinutes;
    if (row.delayReason) mapped.delayReason = row.delayReason;
    mapped.delayEta = hhmm(new Date(windowEnd.getTime() + row.delayMinutes * 60_000));
  }
  return mapped;
}

export type LocationFix = { lat: number; lng: number; accuracy: number; timestamp: number };

/** Thin HTTP client over `tech/interventions` (auth cookie + CSRF added by AuthHttpInterceptor). */
@Injectable({ providedIn: 'root' })
export class TechApi {
  private http = inject(HttpClient);

  getToday(): Observable<ApiTodayResponse> {
    return this.http.get<ApiTodayResponse>(`${API_URL}/today`);
  }

  getIntervention(id: string): Observable<ApiDetailResponse> {
    return this.http.get<ApiDetailResponse>(`${API_URL}/${encodeURIComponent(id)}`);
  }

  /** PATCH transitions answer 204 (no body). */
  transition(id: string, action: TechAction): Observable<void> {
    return this.http.patch<void>(`${API_URL}/${encodeURIComponent(id)}/${ACTION_PATH[action]}`, {});
  }

  reportDelay(id: string, delayMinutes: number, delayReason: string): Observable<void> {
    return this.http.patch<void>(`${API_URL}/${encodeURIComponent(id)}/delay`, { delayMinutes, delayReason });
  }

  /**
   * POST /api/tech/interventions/:id/location. 409 means the trip is no longer EN_ROUTE and the
   * caller must stop watching; any other failure is transient ('error') and does not stop the watch.
   */
  async sendLocation(id: string, fix: LocationFix): Promise<'ok' | 'conflict' | 'error'> {
    try {
      await firstValueFrom(
        this.http.post(`${API_URL}/${encodeURIComponent(id)}/location`, {
          lat: fix.lat,
          lng: fix.lng,
          accuracy: fix.accuracy,
          timestamp: new Date(fix.timestamp).toISOString(),
        }),
      );
      return 'ok';
    } catch (err) {
      return err instanceof HttpErrorResponse && err.status === 409 ? 'conflict' : 'error';
    }
  }
}

@Injectable({ providedIn: 'root' })
export class TechApiService {
  private api = inject(TechApi);

  fetchToday(): Observable<TechTodayResponse> {
    return this.api.getToday().pipe(
      map(res => ({ date: res.date, interventions: res.interventions.map(row => toTechIntervention(row)) })),
    );
  }

  fetchIntervention(id: string): Observable<TechIntervention> {
    return this.api.getIntervention(id).pipe(map(res => toTechIntervention(res.intervention, res.customer)));
  }

  /** Performs the transition, then re-reads the server state. Failures resolve with `success: false`. */
  performAction(interventionId: string, action: TechAction): Observable<ActionResult> {
    return this.api.transition(interventionId, action).pipe(
      switchMap(() => this.fetchIntervention(interventionId)),
      map(intervention => ({ intervention, success: true, optimistic: null, rolledBack: false })),
      catchError(error => of({ intervention: null, success: false, optimistic: null, rolledBack: true, error })),
    );
  }

  reportDelay(
    interventionId: string,
    delayMinutes: number,
    reason: string,
  ): Observable<{ intervention: TechIntervention | null; success: boolean; rolledBack: boolean; error?: unknown }> {
    return this.api.reportDelay(interventionId, delayMinutes, reason).pipe(
      switchMap(() => this.fetchIntervention(interventionId)),
      map(intervention => ({ intervention, success: true, rolledBack: false })),
      catchError(error => of({ intervention: null, success: false, rolledBack: true, error })),
    );
  }
}
