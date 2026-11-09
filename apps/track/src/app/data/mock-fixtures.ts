import type { PublicTrackingProjection } from '@il-arrive/contracts';

/**
 * Mock fixtures for every track-page state.
 * Each fixture is a complete PublicTrackingProjection the API would return.
 * Used by TrackingApi.mockFetch() and component tests.
 */

const baseFixture = {
  businessName: 'Plomberie Martin',
  businessPhone: '01 23 45 67 89',
  technicianFirstName: 'Marc',
  windowStart: '08:00',
  windowEnd: '12:00',
  addressLabel: '12 rue de la Paix, 75002 Paris',
  contactPhone: '01 23 45 67 89',
  interventionDate: '2026-11-12',
};

export const mockFixtures: Record<string, PublicTrackingProjection> = {

  // SCHEDULED, not today — hero shows date, no ETA, no map
  confirmed: {
    ...baseFixture,
    businessLogoUrl: 'assets/logos/plomberie-martin.png',
    status: 'SCHEDULED',
    interventionDate: '2026-11-15',
  },

  // SCHEDULED, today — hero shows window, step 2 current
  planned_today: {
    ...baseFixture,
    status: 'SCHEDULED',
    interventionDate: new Date().toISOString().slice(0, 10),
  },

  // EN_ROUTE, live location — hero shows ETA, map visible, step 3 current pulse
  en_route_live: {
    ...baseFixture,
    status: 'EN_ROUTE',
    eta: '10:42',
    etaComputedAt: '2026-11-12T10:31:00.000Z',
    location: {
      lat: 48.8636,
      lng: 2.3338,
      status: 'FRESH',
      lastFixAt: '2026-11-12T10:31:00.000Z',
    },
  },

  // EN_ROUTE, stale — hero shows last ETA, no map, neutral info card
  en_route_stale: {
    ...baseFixture,
    status: 'EN_ROUTE',
    eta: '10:42',
    etaComputedAt: '2026-11-12T09:58:00.000Z',
    location: {
      lat: 48.8636,
      lng: 2.3338,
      status: 'STALE',
      lastFixAt: '2026-11-12T09:42:00.000Z',
    },
  },

  // EN_ROUTE with delay — warning banner + chip, updated ETA
  delay: {
    ...baseFixture,
    status: 'EN_ROUTE',
    eta: '11:05',
    etaComputedAt: '2026-11-12T10:31:00.000Z',
    delayMinutes: 30,
    delayReason: 'Accident sur l\'autoroute',
    location: {
      lat: 48.8636,
      lng: 2.3338,
      status: 'FRESH',
      lastFixAt: '2026-11-12T10:31:00.000Z',
    },
  },

  // ARRIVED — success hero, no map, step 4 current
  arrived: {
    ...baseFixture,
    status: 'ARRIVED',
  },

  // COMPLETED — success hero, all steps done, no map
  completed: {
    ...baseFixture,
    status: 'COMPLETED',
  },

  // CANCELLED — error banner, neutral hero, partial timeline
  cancelled: {
    ...baseFixture,
    status: 'CANCELLED',
  },

  // RESCHEDULED — warning banner, hero shows new date, timeline resets
  rescheduled: {
    ...baseFixture,
    businessName: 'Plomberie Martin',
    businessPhone: '01 23 45 67 89',
    technicianFirstName: 'Marc',
    windowStart: '08:00',
    windowEnd: '12:00',
    addressLabel: '12 rue de la Paix, 75002 Paris',
    contactPhone: '01 23 45 67 89',
    interventionDate: '2026-11-14',
    status: 'SCHEDULED',
    previousDate: '2026-11-12',
  } as unknown as PublicTrackingProjection,
};

/** Token → fixture key mapping for the mock API */
export const tokenFixtureMap: Record<string, keyof typeof mockFixtures> = {
  'confirmed-abc123': 'confirmed',
  'planned-today-def456': 'planned_today',
  'enroute-live-ghi789': 'en_route_live',
  'enroute-stale-jkl012': 'en_route_stale',
  'delay-mno345': 'delay',
  'arrived-pqr678': 'arrived',
  'completed-stu901': 'completed',
  'cancelled-vwx234': 'cancelled',
  'rescheduled-yza567': 'rescheduled',
};
