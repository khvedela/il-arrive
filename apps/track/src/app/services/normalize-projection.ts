import type { PublicTrackingProjection } from '@il-arrive/contracts';

/**
 * The API sends ISO instants and a top-level `locationStatus`
 * (LIVE | STALE | UNAVAILABLE) with `location` holding coordinates only when
 * the fix is fresh. The page renders Paris wall-clock "HH:mm" strings and a
 * `YYYY-MM-DD` intervention date, so convert once at the boundary.
 * Already-normalised values (fixtures) pass through unchanged.
 */
const HHMM = /^\d{2}:\d{2}$/;

const timeFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const hhmm = (iso: string): string => (HHMM.test(iso) ? iso : timeFmt.format(new Date(iso)));

export function normalizeProjection(wire: PublicTrackingProjection): PublicTrackingProjection {
  const p: PublicTrackingProjection = { ...wire };
  p.interventionDate = wire.interventionDate ?? dateFmt.format(new Date(wire.windowStart));
  p.windowStart = hhmm(wire.windowStart);
  p.windowEnd = hhmm(wire.windowEnd);
  if (wire.eta) p.eta = hhmm(wire.eta);
  // Never fabricate a position: coordinates only exist for a fresh fix.
  if (wire.location && (wire.location.status === 'STALE' || wire.location.lat == null)) {
    p.location = { ...wire.location, status: 'STALE' } as PublicTrackingProjection['location'];
  }
  return p;
}
