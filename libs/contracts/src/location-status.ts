export const EtaSource = {
  TOMTOM: 'tomtom',
  FAKE: 'fake',
} as const;

export type EtaSource = (typeof EtaSource)[keyof typeof EtaSource];

export const LocationStatus = {
  FRESH: 'FRESH',
  STALE: 'STALE',
} as const;

export type LocationStatus = (typeof LocationStatus)[keyof typeof LocationStatus];
