/** Redis keys of a tracking session. All are deleted when the session ends (ARCHITECTURE §5). */
export const TRACKING_CHANNEL = 'trk:updates';
/** Backstop TTL: session hard cap (3 h) + slack, so a missed cleanup cannot leave a position behind. */
export const TRACKING_KEY_TTL_S = 3 * 3600 + 300;

export const trackingKeys = {
  fix: (interventionId: string) => `trk:${interventionId}:fix`,
  etaOrigin: (interventionId: string) => `trk:${interventionId}:eta-origin`,
  etaLock: (interventionId: string) => `trk:${interventionId}:eta-lock`,
  rateLimit: (interventionId: string) => `trk:${interventionId}:rl`,
  staleFlag: (interventionId: string) => `trk:${interventionId}:stale`,
};

export const allTrackingKeys = (interventionId: string): string[] => Object.values(trackingKeys).map((k) => k(interventionId));

export const TRACKING_QUEUE = 'tracking-maintenance';

/** Every position field of a session; nulled when it ends (privacy: nothing retained). */
export const POSITION_RESET = { lastLat: null, lastLng: null, lastAccuracy: null, lastFixAt: null } as const;
