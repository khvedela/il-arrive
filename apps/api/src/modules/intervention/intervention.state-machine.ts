import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InterventionStatus } from './intervention-status';
import type { Intervention } from '@prisma/client';

export type TransitionActionType = 'en_route' | 'stop_route' | 'arrived' | 'complete' | 'cancel' | 'reschedule';

export interface TransitionResult {
  success: boolean;
  intervention: Intervention | null;
  error?: string;
}

export interface StateTransition {
  from: InterventionStatus;
  to: InterventionStatus;
  action: TransitionActionType;
}

export const VALID_TRANSITIONS: StateTransition[] = [
  { from: InterventionStatus.SCHEDULED, to: InterventionStatus.EN_ROUTE, action: 'en_route' },
  { from: InterventionStatus.EN_ROUTE, to: InterventionStatus.ARRIVED, action: 'arrived' },
  { from: InterventionStatus.EN_ROUTE, to: InterventionStatus.SCHEDULED, action: 'stop_route' },
  { from: InterventionStatus.ARRIVED, to: InterventionStatus.COMPLETED, action: 'complete' },
  { from: InterventionStatus.ARRIVED, to: InterventionStatus.SCHEDULED, action: 'reschedule' },
  { from: InterventionStatus.ARRIVED, to: InterventionStatus.CANCELLED, action: 'cancel' },
  { from: InterventionStatus.SCHEDULED, to: InterventionStatus.CANCELLED, action: 'cancel' },
  { from: InterventionStatus.SCHEDULED, to: InterventionStatus.SCHEDULED, action: 'reschedule' },
  { from: InterventionStatus.COMPLETED, to: InterventionStatus.CANCELLED, action: 'cancel' },
];

export function getStateTransition(from: InterventionStatus, action: TransitionActionType): StateTransition | null {
  const transition = VALID_TRANSITIONS.find(
    (t) => t.from === from && t.action === action && (action !== 'reschedule' || from !== InterventionStatus.EN_ROUTE),
  );
  return transition ?? null;
}

export function isValidTransition(from: InterventionStatus, action: TransitionActionType): boolean {
  const transition = getStateTransition(from, action);
  return transition !== null;
}

export function getAllowedTransitions(status: InterventionStatus): StateTransition[] {
  return VALID_TRANSITIONS.filter((t) => t.from === status);
}

export function transitionIntervention(
  intervention: Intervention,
  action: TransitionActionType,
  actorId: string,
): { intervention: Intervention; event: { type: string; payload: any } } {
  const fromStatus = intervention.status;
  const transition = getStateTransition(fromStatus, action);

  if (!transition) {
    throw new ForbiddenException(`Cannot transition from ${fromStatus} with action ${action}`);
  }

  const toStatus = transition.to;

  const updatedIntervention: Intervention = {
    ...intervention,
    status: toStatus,
    updatedAt: new Date(),
  };

  const event = {
    type: `intervention.${toStatus.toLowerCase()}`,
    payload: {
      interventionId: intervention.id,
      actorId,
      fromStatus,
      toStatus,
      action,
    },
  };

  return { intervention: updatedIntervention, event };
}

export class InterventionStateMachine {
  private readonly transitions: Map<InterventionStatus, Set<InterventionStatus>> = new Map();

  constructor() {
    VALID_TRANSITIONS.forEach((t) => {
      if (!this.transitions.has(t.from)) {
        this.transitions.set(t.from, new Set());
      }
      this.transitions.get(t.from)!.add(t.to);
    });
  }

  getValidTransitions(status: InterventionStatus): InterventionStatus[] {
    return Array.from(this.transitions.get(status) || []);
  }

  canTransition(from: InterventionStatus, to: InterventionStatus): boolean {
    return this.transitions.get(from)?.has(to) || false;
  }

  validateTransition(intervention: Intervention, action: TransitionActionType): void {
    const fromStatus = intervention.status;
    const transition = getStateTransition(fromStatus, action);

    if (!transition) {
      const allowed = this.getValidTransitions(fromStatus);
      throw new ForbiddenException(
        `Invalid transition from ${fromStatus} with action ${action}. Allowed: ${allowed.join(', ')}`,
      );
    }
  }

  async applyTransition(
    intervention: Intervention,
    action: TransitionActionType,
    actorId: string,
    reason?: string,
    newScheduledDate?: string,
    newWindowStart?: string,
    newWindowEnd?: string,
  ): Promise<{ intervention: Intervention; event: any }> {
    this.validateTransition(intervention, action);

    const fromStatus = intervention.status;
    const toStatus = this.getValidTransitions(fromStatus).find((s) => {
      const t = VALID_TRANSITIONS.find((tr) => tr.from === fromStatus && tr.to === s && tr.action === action);
      return t !== undefined;
    });

    if (!toStatus) {
      throw new NotFoundException(`Cannot find valid transition for action ${action}`);
    }

    const updatedIntervention: Intervention = {
      ...intervention,
      status: toStatus,
      updatedAt: new Date(),
    };

    if (action === 'cancel' && reason) {
      updatedIntervention.cancelledReason = reason;
    }

    if (action === 'reschedule' && (newScheduledDate || newWindowStart || newWindowEnd)) {
      if (newScheduledDate) {
        updatedIntervention.scheduledDate = new Date(newScheduledDate);
      }
      if (newWindowStart) {
        updatedIntervention.windowStart = new Date(newWindowStart);
      }
      if (newWindowEnd) {
        updatedIntervention.windowEnd = new Date(newWindowEnd);
      }
    }

    const event = {
      type: `intervention.${toStatus.toLowerCase()}`,
      payload: {
        interventionId: intervention.id,
        actorId,
        fromStatus,
        toStatus,
        action,
        reason,
        newScheduledDate,
        newWindowStart,
        newWindowEnd,
      },
    };

    return { intervention: updatedIntervention, event };
  }
}

export function resolveConflict(intervention: Intervention, action: TransitionActionType): boolean {
  const fromStatus = intervention.status;
  const denyList: Record<string, TransitionActionType[]> = {
    COMPLETED: ['en_route', 'stop_route', 'arrived', 'reschedule', 'cancel'],
    CANCELLED: ['en_route', 'stop_route', 'arrived', 'complete', 'reschedule', 'cancel'],
  };

  if (denyList[fromStatus] && denyList[fromStatus].includes(action)) {
    throw new ConflictException(`Cannot perform ${action} on intervention with status ${fromStatus}`);
  }

  const transition = getStateTransition(fromStatus, action);
  if (!transition) {
    throw new ConflictException(`Cannot perform ${action} on intervention with status ${fromStatus}`);
  }

  return true;
}

export function canPerformAction(intervention: Intervention, action: TransitionActionType): boolean {
  try {
    resolveConflict(intervention, action);
    return true;
  } catch {
    return false;
  }
}
