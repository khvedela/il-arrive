import type { InterventionStatus } from './intervention-status';
import type { LocationStatus, EtaSource } from './location-status';

export type SSEEventType =
  | 'status_change'
  | 'eta_update'
  | 'location_update'
  | 'delay_update'
  | 'session_end';

export interface SSEEvent {
  id: string;
  event: SSEEventType;
  data: SSEEventData;
  created_at: string;
}

export interface SSEStatusChangeEvent {
  event: 'status_change';
  data: {
    status: InterventionStatus;
  };
}

export interface SSEEtaUpdateEvent {
  event: 'eta_update';
  data: {
    eta: string;
    etaComputedAt: string;
    etaSource: EtaSource;
  };
}

export interface SSELocationUpdateEvent {
  event: 'location_update';
  data: {
    lat: number;
    lng: number;
    status: LocationStatus;
    lastFixAt: string;
  };
}

export interface SSEDelayUpdateEvent {
  event: 'delay_update';
  data: {
    delayMinutes: number;
    delayReason: string;
  };
}

export interface SSESSESessionEndEvent {
  event: 'session_end';
  data: {
    status: InterventionStatus;
  };
}

export type SSEEventData =
  | SSEStatusChangeEvent['data']
  | SSEEtaUpdateEvent['data']
  | SSELocationUpdateEvent['data']
  | SSEDelayUpdateEvent['data']
  | SSESSESessionEndEvent['data'];
