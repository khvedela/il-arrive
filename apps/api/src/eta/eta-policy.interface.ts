export interface ETAStatus {
  status: 'LIVE' | 'STALE' | 'UNAVAILABLE';
  etaAt: Date | null;
  etaSource: string | null;
  computedAt: Date | null;
  lastNotifiedEtaAt: Date | null;
  lastLat: number | null;
  lastLng: number | null;
  lastAccuracy: number | null;
  lastFixAt: Date | null;
}

export interface FixValidationResult {
  valid: boolean;
  reason?: string;
}

export interface LocationRequest {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: Date;
}

export interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy: number;
  fixAt: Date;
}

export interface ETAUpdate {
  etaAt: Date;
  etaSource: string;
  computedAt: Date;
}

export interface SessionExpiry {
  expired: boolean;
  reason?: string;
  endedAt: Date | null;
}

export interface PositionRounder {
  round(lat: number, lng: number): { lat: number; lng: number };
}

export interface ETAStalenessPolicy {
  shouldRecompute(lastComputedAt: Date | null, lastFixAt: Date | null, lastLat: number | null, lastLng: number | null, currentLat: number, currentLng: number, now?: Date): boolean;
  validateFix(lat: number, lng: number, accuracy: number, timestamp: Date, now?: Date): FixValidationResult;
  getStatus(etaAt: Date | null, computedAt: Date | null, lastFixAt: Date | null, now?: Date): ETAStatus;
  roundPosition(lat: number, lng: number): { lat: number; lng: number };
  checkSessionExpiry(startedAt: Date, lastFixAt: Date | null, now: Date): SessionExpiry;
}
