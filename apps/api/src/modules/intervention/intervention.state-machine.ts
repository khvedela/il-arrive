import { InterventionStatus } from '@prisma/client';

/** Actions a user can request. `stop_route` and `reschedule` are actions, not statuses. */
export type TransitionActionType = 'en_route' | 'stop_route' | 'arrived' | 'complete' | 'cancel' | 'reschedule';

export const TRANSITION_ACTIONS: readonly TransitionActionType[] = [
  'en_route',
  'stop_route',
  'arrived',
  'complete',
  'cancel',
  'reschedule',
];

export interface StateTransition {
  from: InterventionStatus;
  to: InterventionStatus;
  action: TransitionActionType;
}

/** docs/ARCHITECTURE.md §3 — the single source of truth for allowed transitions. */
export const VALID_TRANSITIONS: readonly StateTransition[] = [
  { from: 'SCHEDULED', to: 'EN_ROUTE', action: 'en_route' },
  { from: 'EN_ROUTE', to: 'ARRIVED', action: 'arrived' },
  { from: 'EN_ROUTE', to: 'SCHEDULED', action: 'stop_route' },
  { from: 'ARRIVED', to: 'COMPLETED', action: 'complete' },
  { from: 'SCHEDULED', to: 'CANCELLED', action: 'cancel' },
  { from: 'EN_ROUTE', to: 'CANCELLED', action: 'cancel' },
  { from: 'ARRIVED', to: 'CANCELLED', action: 'cancel' },
  { from: 'SCHEDULED', to: 'SCHEDULED', action: 'reschedule' },
  { from: 'EN_ROUTE', to: 'SCHEDULED', action: 'reschedule' },
];

export const EVENT_TYPES: Record<TransitionActionType, string> = {
  en_route: 'intervention.en_route',
  stop_route: 'intervention.stop_route',
  arrived: 'intervention.arrived',
  complete: 'intervention.completed',
  cancel: 'intervention.cancelled',
  reschedule: 'intervention.rescheduled',
};

/** Statuses on which a delay may be reported (overlay, not a state). */
export const DELAY_ALLOWED_STATUSES: readonly InterventionStatus[] = ['SCHEDULED', 'EN_ROUTE'];

export interface TransitionInput {
  status: InterventionStatus;
  scheduledDate: Date;
  windowStart: Date;
  windowEnd: Date;
}

export interface TransitionParams {
  reason?: string;
  newScheduledDate?: Date;
  newWindowStart?: Date;
  newWindowEnd?: Date;
  now?: Date;
}

export interface TransitionPatch {
  status: InterventionStatus;
  scheduledDate?: Date;
  windowStart?: Date;
  windowEnd?: Date;
  cancelledReason?: string;
  completedAt?: Date;
  /** Reschedule / stop_route / cancel clear any reported delay. */
  delayMinutes?: null;
  delayReason?: null;
}

export interface TransitionEvent {
  type: string;
  payload: Record<string, unknown>;
}

export type TransitionResult =
  | { ok: true; from: InterventionStatus; to: InterventionStatus; patch: TransitionPatch; event: TransitionEvent }
  | { ok: false; error: 'INVALID_TRANSITION' | 'INVALID_PARAMS'; message: string };

export function getTransition(from: InterventionStatus, action: TransitionActionType): StateTransition | undefined {
  return VALID_TRANSITIONS.find((t) => t.from === from && t.action === action);
}

export function allowedActions(status: InterventionStatus): TransitionActionType[] {
  return VALID_TRANSITIONS.filter((t) => t.from === status).map((t) => t.action);
}

/**
 * Pure transition function: no I/O, no clock unless `params.now` is omitted.
 * Returns the DB patch and the timeline event; callers persist both atomically.
 */
export function transition(
  intervention: TransitionInput,
  action: TransitionActionType,
  actorId: string,
  params: TransitionParams = {},
): TransitionResult {
  const t = getTransition(intervention.status, action);
  if (!t) {
    return {
      ok: false,
      error: 'INVALID_TRANSITION',
      message: `Cannot ${action} an intervention that is ${intervention.status}`,
    };
  }

  const patch: TransitionPatch = { status: t.to };
  const payload: Record<string, unknown> = { actorId, action, fromStatus: t.from, toStatus: t.to };

  if (action === 'cancel') {
    if (!params.reason?.trim()) {
      return { ok: false, error: 'INVALID_PARAMS', message: 'A reason is required to cancel' };
    }
    patch.cancelledReason = params.reason.trim();
    patch.delayMinutes = null;
    patch.delayReason = null;
    payload.reason = patch.cancelledReason;
  }

  if (action === 'complete') {
    patch.completedAt = params.now ?? new Date();
  }

  if (action === 'stop_route') {
    patch.delayMinutes = null;
    patch.delayReason = null;
  }

  if (action === 'reschedule') {
    const { newScheduledDate, newWindowStart, newWindowEnd } = params;
    if (!newScheduledDate || !newWindowStart || !newWindowEnd) {
      return { ok: false, error: 'INVALID_PARAMS', message: 'Reschedule needs a new date and window' };
    }
    if (!(newWindowStart.getTime() < newWindowEnd.getTime())) {
      return { ok: false, error: 'INVALID_PARAMS', message: 'Window start must be before window end' };
    }
    patch.scheduledDate = newScheduledDate;
    patch.windowStart = newWindowStart;
    patch.windowEnd = newWindowEnd;
    patch.delayMinutes = null;
    patch.delayReason = null;
    payload.newScheduledDate = newScheduledDate.toISOString();
    payload.newWindowStart = newWindowStart.toISOString();
    payload.newWindowEnd = newWindowEnd.toISOString();
    if (params.reason) payload.reason = params.reason;
  }

  return {
    ok: true,
    from: t.from,
    to: t.to,
    patch,
    event: { type: EVENT_TYPES[action], payload },
  };
}
