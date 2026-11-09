import type { InterventionStatus } from '@il-arrive/contracts';
import type { InterventionRow } from './dashboard-api.service';

export interface TodayGroups {
  enRoute: InterventionRow[];
  late: InterventionRow[];
  upcoming: InterventionRow[];
  done: InterventionRow[];
}

/** Dispatcher grouping: En route / En retard / À venir / Terminées. */
export function groupToday(rows: InterventionRow[], now = new Date()): TodayGroups {
  const g: TodayGroups = { enRoute: [], late: [], upcoming: [], done: [] };
  for (const r of rows) {
    if (r.status === 'EN_ROUTE' || r.status === 'ARRIVED') g.enRoute.push(r);
    else if (r.status === 'COMPLETED' || r.status === 'CANCELLED') g.done.push(r);
    else if ((r.delayMinutes ?? 0) > 0 || new Date(r.windowEnd) < now) g.late.push(r);
    else g.upcoming.push(r);
  }
  return g;
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtWindow(r: Pick<InterventionRow, 'windowStart' | 'windowEnd'>): string {
  return `${fmtTime(r.windowStart)}–${fmtTime(r.windowEnd)}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Local `YYYY-MM-DD` of an ISO instant (what the date input expects). */
export function toDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Combine a local `YYYY-MM-DD` and `HH:mm` into an ISO instant. */
export function toIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

export function techName(r: InterventionRow): string {
  return r.technician ? `${r.technician.user.firstName} ${r.technician.user.lastName}`.trim() : '';
}

export function statusLabel(s: InterventionStatus): string {
  switch (s) {
    case 'SCHEDULED': return $localize`:@@status.scheduled:Planifiée`;
    case 'EN_ROUTE': return $localize`:@@status.enRoute:En route`;
    case 'ARRIVED': return $localize`:@@status.arrived:Sur place`;
    case 'COMPLETED': return $localize`:@@status.completed:Terminée`;
    case 'CANCELLED': return $localize`:@@status.cancelled:Annulée`;
  }
}

export function eventLabel(type: string): string {
  const known: Record<string, string> = {
    'intervention.created': $localize`:@@event.created:Intervention créée`,
    'intervention.updated': $localize`:@@event.updated:Intervention modifiée`,
    'intervention.assigned': $localize`:@@event.assigned:Technicien assigné`,
    'intervention.en_route': $localize`:@@event.enRoute:Technicien en route`,
    'intervention.arrived': $localize`:@@event.arrived:Technicien sur place`,
    'intervention.completed': $localize`:@@event.completed:Intervention terminée`,
    'intervention.cancelled': $localize`:@@event.cancelled:Intervention annulée`,
    'intervention.rescheduled': $localize`:@@event.rescheduled:Intervention reprogrammée`,
  };
  return known[type] ?? type;
}
