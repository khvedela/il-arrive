export const EtaSource = {
  TOMTOM: 'tomtom',
  FAKE: 'fake',
} as const;

export type EtaSource = (typeof EtaSource)[keyof typeof EtaSource];

/** Top-level availability of the technician position (server `locationStatus`). */
export const LocationStatus = {
  LIVE: 'LIVE',
  STALE: 'STALE',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export type LocationStatus = (typeof LocationStatus)[keyof typeof LocationStatus];

/** Freshness of the nested `location` fix. Coordinates are omitted when STALE. */
export const LocationFixStatus = {
  FRESH: 'FRESH',
  STALE: 'STALE',
} as const;

export type LocationFixStatus = (typeof LocationFixStatus)[keyof typeof LocationFixStatus];
