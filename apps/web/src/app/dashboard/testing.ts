import type { InterventionRow } from './dashboard-api.service';

export function makeRow(over: Partial<InterventionRow> = {}): InterventionRow {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const at = (h: number) => new Date(day.getTime() + h * 3600_000).toISOString();
  return {
    id: 'i1',
    customerId: 'c1',
    technicianMembershipId: null,
    addressLabel: '12 rue de la Paix, Paris',
    addressLat: 48.87,
    addressLng: 2.32,
    scheduledDate: at(0),
    windowStart: at(23),
    windowEnd: at(23.9),
    description: null,
    internalNotes: null,
    status: 'SCHEDULED',
    delayMinutes: null,
    delayReason: null,
    cancelledReason: null,
    customer: { id: 'c1', name: 'Marie Dupont', phone: '+33612345678' },
    technician: null,
    ...over,
  };
}
