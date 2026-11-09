import type { InterventionStatus } from '@il-arrive/contracts';

export type InterventionEventName =
  | 'intervention.created'
  | 'intervention.en_route'
  | 'intervention.stop_route'
  | 'intervention.arrived'
  | 'intervention.completed'
  | 'intervention.cancelled'
  | 'intervention.rescheduled'
  | 'intervention.delayed';

export interface InterventionEventPayload {
  interventionId: string;
  actorId: string;
  [key: string]: unknown;
}

export interface InterventionCreatedEvent {
  eventName: 'intervention.created';
  payload: {
    interventionId: string;
    actorId: string;
    customerId: string;
    technicianMembershipId?: string;
    status: InterventionStatus;
    scheduledDate: string;
    windowStart: string;
    windowEnd: string;
    addressLabel: string;
    addressLat: number;
    addressLng: number;
    description?: string;
  };
}

export interface InterventionEnRouteEvent {
  eventName: 'intervention.en_route';
  payload: {
    interventionId: string;
    actorId: string;
    fromStatus: InterventionStatus;
    toStatus: InterventionStatus;
    action: 'en_route';
    reason?: string;
  };
}

export interface InterventionStopRouteEvent {
  eventName: 'intervention.stop_route';
  payload: {
    interventionId: string;
    actorId: string;
    fromStatus: InterventionStatus;
    toStatus: InterventionStatus;
    action: 'stop_route';
    reason?: string;
  };
}

export interface InterventionArrivedEvent {
  eventName: 'intervention.arrived';
  payload: {
    interventionId: string;
    actorId: string;
    fromStatus: InterventionStatus;
    toStatus: InterventionStatus;
    action: 'arrived';
    reason?: string;
  };
}

export interface InterventionCompletedEvent {
  eventName: 'intervention.completed';
  payload: {
    interventionId: string;
    actorId: string;
    fromStatus: InterventionStatus;
    toStatus: InterventionStatus;
    action: 'complete';
    reason?: string;
  };
}

export interface InterventionCancelledEvent {
  eventName: 'intervention.cancelled';
  payload: {
    interventionId: string;
    actorId: string;
    fromStatus: InterventionStatus;
    toStatus: InterventionStatus;
    action: 'cancel';
    reason: string;
  };
}

export interface InterventionRescheduledEvent {
  eventName: 'intervention.rescheduled';
  payload: {
    interventionId: string;
    actorId: string;
    fromStatus: InterventionStatus;
    toStatus: InterventionStatus;
    action: 'reschedule';
    reason?: string;
    newScheduledDate?: string;
    newWindowStart?: string;
    newWindowEnd?: string;
  };
}

export interface InterventionDelayedEvent {
  eventName: 'intervention.delayed';
  payload: {
    interventionId: string;
    actorId: string;
    delayMinutes: number;
    delayReason: string;
  };
}

export type InterventionEvent =
  | InterventionCreatedEvent
  | InterventionEnRouteEvent
  | InterventionStopRouteEvent
  | InterventionArrivedEvent
  | InterventionCompletedEvent
  | InterventionCancelledEvent
  | InterventionRescheduledEvent
  | InterventionDelayedEvent;

export function createInterventionCreatedEvent(payload: InterventionCreatedEvent['payload']): InterventionCreatedEvent {
  return {
    eventName: 'intervention.created',
    payload,
  };
}

export function createInterventionEnRouteEvent(payload: InterventionEnRouteEvent['payload']): InterventionEnRouteEvent {
  return {
    eventName: 'intervention.en_route',
    payload,
  };
}

export function createInterventionArrivedEvent(payload: InterventionArrivedEvent['payload']): InterventionArrivedEvent {
  return {
    eventName: 'intervention.arrived',
    payload,
  };
}

export function createInterventionCompletedEvent(payload: InterventionCompletedEvent['payload']): InterventionCompletedEvent {
  return {
    eventName: 'intervention.completed',
    payload,
  };
}

export function createInterventionCancelledEvent(payload: InterventionCancelledEvent['payload']): InterventionCancelledEvent {
  return {
    eventName: 'intervention.cancelled',
    payload,
  };
}

export function createInterventionRescheduledEvent(payload: InterventionRescheduledEvent['payload']): InterventionRescheduledEvent {
  return {
    eventName: 'intervention.rescheduled',
    payload,
  };
}

export function createInterventionDelayedEvent(payload: InterventionDelayedEvent['payload']): InterventionDelayedEvent {
  return {
    eventName: 'intervention.delayed',
    payload,
  };
}
