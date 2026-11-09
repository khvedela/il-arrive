import type { PublicTrackingProjection } from '@il-arrive/contracts';
import { normalizeProjection } from './normalize-projection';

const wire = {
  businessName: 'Acme',
  businessPhone: '+33100000000',
  contactPhone: '+33100000000',
  technicianFirstName: 'Karim',
  status: 'EN_ROUTE',
  windowStart: '2026-11-12T07:00:00.000Z',
  windowEnd: '2026-11-12T11:00:00.000Z',
  addressLabel: '1 rue X',
  eta: '2026-11-12T09:42:00.000Z',
} as unknown as PublicTrackingProjection;

describe('normalizeProjection', () => {
  it('converts API instants to Paris wall-clock times and derives the date', () => {
    const p = normalizeProjection(wire);
    expect(p.windowStart).toBe('08:00');
    expect(p.windowEnd).toBe('12:00');
    expect(p.eta).toBe('10:42');
    expect(p.interventionDate).toBe('2026-11-12');
  });

  it('is idempotent on already-normalised values', () => {
    const once = normalizeProjection(wire);
    expect(normalizeProjection(once)).toEqual(once);
  });

  it('never invents coordinates for a stale fix', () => {
    const p = normalizeProjection({
      ...wire,
      location: { status: 'STALE', lastFixAt: '2026-11-12T09:00:00.000Z' },
    } as unknown as PublicTrackingProjection);
    expect(p.location?.status).toBe('STALE');
    expect(p.location).not.toHaveProperty('lat');
  });
});
