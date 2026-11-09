import { Injectable, inject } from '@angular/core';
import { InterventionStatus as IS } from '@il-arrive/contracts/enums';
import type { InterventionStatus } from '@il-arrive/contracts';
import type { TechIntervention, TechTodayResponse, TransitionResult } from '../models/intervention';
import { of, defer, type Observable } from 'rxjs';
import { map, catchError, delay } from 'rxjs/operators';

export type TechAction = 'en_route' | 'arrived' | 'complete' | 'cancel' | 'stop_route';

export const ACTION_TO_STATUS: Record<TechAction, InterventionStatus> = {
  en_route: IS.EN_ROUTE,
  arrived: IS.ARRIVED,
  complete: IS.COMPLETED,
  cancel: IS.CANCELLED,
  stop_route: IS.SCHEDULED,
};

export const VALID_TRANSITIONS: Record<InterventionStatus, TechAction[]> = {
  [IS.SCHEDULED]: ['en_route', 'cancel', 'stop_route'],
  [IS.EN_ROUTE]: ['arrived', 'cancel', 'stop_route'],
  [IS.ARRIVED]: ['complete', 'cancel'],
  [IS.COMPLETED]: [],
  [IS.CANCELLED]: [],
};

function applyStatus(intervention: TechIntervention, status: InterventionStatus): TechIntervention {
  const base = { ...intervention };
  base.status = status;
  if (status === IS.COMPLETED || status === IS.CANCELLED) {
    delete base.delayMinutes;
    delete base.delayReason;
    delete base.delayEta;
  }
  return base;
}

export interface ActionResult {
  intervention: TechIntervention;
  success: boolean;
  optimistic: TechIntervention | null;
  rolledBack: boolean;
  error?: unknown;
}

export interface TechApiConfig {
  baseUrl?: string;
  useMock?: boolean;
}

function generateMockData(): TechIntervention[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'int-001',
      customerId: 'cust-001',
      customerName: 'Marie Dupont',
      customerPhone: '06 12 34 56 78',
      addressLabel: '12 rue de la Paix, 75002 Paris',
      addressLat: 48.8698,
      addressLng: 2.3213,
      lat: 48.8698,
      lng: 2.3213,
      scheduledDate: today,
      windowStart: '08:00',
      windowEnd: '12:00',
      status: IS.EN_ROUTE,
      description: 'Fuite sous évier, urgent',
      internalNotes: 'Client difficile, appeler avant de venir',
      delayMinutes: 30,
      delayReason: 'Accident sur l\'autoroute',
      delayEta: '11:05',
      technicianName: 'Marc Lefebvre',
    },
    {
      id: 'int-002',
      customerId: 'cust-002',
      customerName: 'Paul Bernard',
      customerPhone: '07 98 76 54 32',
      addressLabel: '4 av. Victor Hugo, 69003 Lyon',
      addressLat: 45.7579,
      addressLng: 4.832,
      lat: 45.7579,
      lng: 4.832,
      scheduledDate: today,
      windowStart: '13:00',
      windowEnd: '14:00',
      status: IS.SCHEDULED,
      description: 'Chaudière ne démarre plus',
      technicianName: 'Marc Lefebvre',
    },
    {
      id: 'int-003',
      customerId: 'cust-003',
      customerName: 'Julie Moreau',
      customerPhone: '06 11 22 33 44',
      addressLabel: '22 rue des Lilas, 69008 Lyon',
      addressLat: 45.7445,
      addressLng: 4.8275,
      lat: 45.7445,
      lng: 4.8275,
      scheduledDate: today,
      windowStart: '15:00',
      windowEnd: '16:00',
      status: IS.SCHEDULED,
      technicianName: 'Marc Lefebvre',
    },
    {
      id: 'int-004',
      customerId: 'cust-004',
      customerName: 'Luc Martin',
      customerPhone: '06 55 44 33 22',
      addressLabel: '5 place de la République, 75003 Paris',
      addressLat: 48.8670,
      addressLng: 2.3644,
      lat: 48.8670,
      lng: 2.3644,
      scheduledDate: today,
      windowStart: '10:00',
      windowEnd: '11:00',
      status: IS.COMPLETED,
      description: 'Remplacement robinet cuisine',
      technicianName: 'Marc Lefebvre',
    },
    {
      id: 'int-005',
      customerId: 'cust-005',
      customerName: 'Ana Garcia',
      customerPhone: '07 22 11 88 99',
      addressLabel: '8 rue Pasteur, 69002 Lyon',
      addressLat: 45.7532,
      addressLng: 4.8268,
      lat: 45.7532,
      lng: 4.8268,
      scheduledDate: today,
      windowStart: '14:00',
      windowEnd: '15:00',
      status: IS.SCHEDULED,
      description: 'Installation mitigeur salle de bain',
      technicianName: 'Marc Lefebvre',
    },
  ];
}

@Injectable({ providedIn: 'root' })
export class TechApi {
  private mockData = generateMockData();

  getTodayInterventions(): TechTodayResponse | null {
    const today = new Date().toISOString().split('T')[0];
    return {
      date: today,
      interventions: [...this.mockData],
    };
  }

  getIntervention(id: string): TechIntervention | null {
    return this.mockData.find(i => i.id === id) || null;
  }

  transition(id: string, action: TechAction, reason?: string): TransitionResult | null {
    const idx = this.mockData.findIndex(i => i.id === id);
    if (idx === -1) return null;

    const current = this.mockData[idx];
    const newStatus = ACTION_TO_STATUS[action];
    current.status = newStatus;
    if (newStatus === IS.COMPLETED || newStatus === IS.CANCELLED) {
      delete current.delayMinutes;
      delete current.delayReason;
      delete current.delayEta;
    }

    if (action === 'stop_route' && reason) {
      current.internalNotes = (current.internalNotes ? current.internalNotes + '\n' : '') + '[stop_route] ' + reason;
    }

    return { intervention: { ...current }, success: true };
  }

  reportDelay(dto: { interventionId: string; delayMinutes: number; delayReason: string }): TransitionResult | null {
    const idx = this.mockData.findIndex(i => i.id === dto.interventionId);
    if (idx === -1) return null;

    const current = this.mockData[idx];
    current.delayMinutes = dto.delayMinutes;
    current.delayReason = dto.delayReason;

    const baseEta = this.parseTime(current.windowEnd || '12:00');
    const newEtaMin = baseEta + dto.delayMinutes;
    current.delayEta = this.formatTime(newEtaMin);

    return { intervention: { ...current }, success: true };
  }

  /** Mock location endpoint: 409 unless the intervention is EN_ROUTE. */
  readonly sentLocations: Array<{ id: string; lat: number; lng: number; accuracy: number; timestamp: number }> = [];

  async sendLocation(id: string, fix: { lat: number; lng: number; accuracy: number; timestamp: number }): Promise<'ok' | 'conflict'> {
    const inv = this.mockData.find(i => i.id === id);
    if (!inv || inv.status !== IS.EN_ROUTE) return 'conflict';
    this.sentLocations.push({ id, ...fix });
    return 'ok';
  }

  private parseTime(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  private formatTime(totalMin: number): string {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}

@Injectable({ providedIn: 'root' })
export class TechApiService {
  private api = inject(TechApi);

  fetchToday() {
    return defer(() => {
      const data = this.api.getTodayInterventions();
      if (!data) throw new Error('No data');
      return of(data).pipe(delay(300));
    }).pipe(
      catchError(err => {
        console.error('Failed to fetch today interventions', err);
        throw err;
      })
    );
  }

  fetchIntervention(id: string) {
    return defer(() => {
      const data = this.api.getIntervention(id);
      if (!data) throw new Error('Intervention not found');
      return of(data).pipe(delay(200));
    }).pipe(
      catchError(err => {
        console.error('Failed to fetch intervention', err);
        throw err;
      })
    );
  }

  performAction(interventionId: string, action: TechAction, reason?: string): Observable<ActionResult> {
    const prevState = this.api.getIntervention(interventionId);
    if (!prevState) {
      return of({ intervention: null as unknown as TechIntervention, success: false, rolledBack: true, optimistic: null, error: new Error('Intervention not found') });
    }

    const optimisticStatus = ACTION_TO_STATUS[action];
    const optimisticState = applyStatus(prevState, optimisticStatus);

    return defer(() => {
      const result = this.api.transition(interventionId, action, reason);
      if (!result) throw new Error('Transition failed');
      return of(result).pipe(delay(400));
    }).pipe(
      map(result => ({
        ...result,
        optimistic: optimisticState,
        rolledBack: false,
      })),
      catchError(err => {
        return of({
          intervention: prevState,
          success: false,
          optimistic: optimisticState,
          rolledBack: true,
          error: err,
        });
      })
    );
  }

  reportDelay(interventionId: string, delayMinutes: number, reason: string): Observable<{ intervention: TechIntervention; success: boolean; rolledBack: boolean; error?: unknown }> {
    const prevState = this.api.getIntervention(interventionId);
    if (!prevState) {
      return of({ intervention: null as unknown as TechIntervention, success: false, rolledBack: true, error: new Error('Intervention not found') });
    }

    return defer(() => {
      const result = this.api.reportDelay({
        interventionId,
        delayMinutes,
        delayReason: reason,
      });
      if (!result) throw new Error('Delay report failed');
      return of({ ...result, rolledBack: false }).pipe(delay(400));
    }).pipe(
      catchError(err => {
        return of({
          intervention: prevState,
          success: false,
          rolledBack: true,
          error: err,
        });
      })
    );
  }
}
