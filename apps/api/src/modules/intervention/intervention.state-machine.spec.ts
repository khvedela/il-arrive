import { ConflictException, ForbiddenException } from '@nestjs/common';
import { InterventionStateMachine, resolveConflict, canPerformAction } from './intervention.state-machine';
import { InterventionStatus } from './intervention-status';

describe('InterventionStateMachine', () => {
  let stateMachine: InterventionStateMachine;

  beforeEach(() => {
    stateMachine = new InterventionStateMachine();
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for SCHEDULED status', () => {
      const transitions = stateMachine.getValidTransitions(InterventionStatus.SCHEDULED);
      expect(transitions).toEqual([
        InterventionStatus.EN_ROUTE,
        InterventionStatus.CANCELLED,
        InterventionStatus.SCHEDULED,
      ]);
    });

    it('should return valid transitions for EN_ROUTE status', () => {
      const transitions = stateMachine.getValidTransitions(InterventionStatus.EN_ROUTE);
      expect(transitions).toEqual([InterventionStatus.ARRIVED, InterventionStatus.SCHEDULED]);
    });

    it('should return valid transitions for ARRIVED status', () => {
      const transitions = stateMachine.getValidTransitions(InterventionStatus.ARRIVED);
      expect(transitions).toEqual([InterventionStatus.COMPLETED, InterventionStatus.SCHEDULED, InterventionStatus.CANCELLED]);
    });

    it('should return valid transitions for COMPLETED status', () => {
      const transitions = stateMachine.getValidTransitions(InterventionStatus.COMPLETED);
      expect(transitions).toEqual([InterventionStatus.CANCELLED]);
    });

    it('should return valid transitions for CANCELLED status', () => {
      const transitions = stateMachine.getValidTransitions(InterventionStatus.CANCELLED);
      expect(transitions).toEqual([]);
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      expect(stateMachine.canTransition(InterventionStatus.SCHEDULED, InterventionStatus.EN_ROUTE)).toBe(true);
      expect(stateMachine.canTransition(InterventionStatus.EN_ROUTE, InterventionStatus.ARRIVED)).toBe(true);
      expect(stateMachine.canTransition(InterventionStatus.ARRIVED, InterventionStatus.COMPLETED)).toBe(true);
      expect(stateMachine.canTransition(InterventionStatus.SCHEDULED, InterventionStatus.CANCELLED)).toBe(true);
      expect(stateMachine.canTransition(InterventionStatus.COMPLETED, InterventionStatus.CANCELLED)).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(stateMachine.canTransition(InterventionStatus.EN_ROUTE, InterventionStatus.COMPLETED)).toBe(false);
      expect(stateMachine.canTransition(InterventionStatus.ARRIVED, InterventionStatus.EN_ROUTE)).toBe(false);
      expect(stateMachine.canTransition(InterventionStatus.COMPLETED, InterventionStatus.ARRIVED)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transitions', () => {
      const intervention = { status: InterventionStatus.SCHEDULED, id: '1' } as any;
      expect(() => stateMachine.validateTransition(intervention, 'en_route')).not.toThrow();
    });

    it('should throw ForbiddenException for invalid transitions', () => {
      const intervention = { status: InterventionStatus.EN_ROUTE, id: '1' } as any;
      expect(() => stateMachine.validateTransition(intervention, 'complete')).toThrow(ForbiddenException);
      expect(() => stateMachine.validateTransition(intervention, 'complete')).toThrow(
        'Invalid transition from EN_ROUTE with action complete. Allowed: ARRIVED, SCHEDULED',
      );
    });

    it('should throw ForbiddenException for CANCELLED status', () => {
      const intervention = { status: InterventionStatus.CANCELLED, id: '1' } as any;
      expect(() => stateMachine.validateTransition(intervention, 'en_route')).toThrow(ForbiddenException);
    });
  });

  describe('applyTransition', () => {
    it('should transition SCHEDULED -> EN_ROUTE with en_route action', async () => {
      const intervention = {
        id: '1',
        status: InterventionStatus.SCHEDULED,
        scheduledDate: new Date(),
        windowStart: new Date(),
        windowEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = await stateMachine.applyTransition(intervention, 'en_route', 'actor-1');

      expect(result.intervention.status).toBe(InterventionStatus.EN_ROUTE);
      expect(result.event.type).toBe('intervention.en_route');
      expect(result.event.payload).toEqual({
        interventionId: '1',
        actorId: 'actor-1',
        fromStatus: InterventionStatus.SCHEDULED,
        toStatus: InterventionStatus.EN_ROUTE,
        action: 'en_route',
        reason: undefined,
        newScheduledDate: undefined,
        newWindowStart: undefined,
        newWindowEnd: undefined,
      });
    });

    it('should transition ARRIVED -> COMPLETED with complete action', async () => {
      const intervention = {
        id: '2',
        status: InterventionStatus.ARRIVED,
        scheduledDate: new Date(),
        windowStart: new Date(),
        windowEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = await stateMachine.applyTransition(intervention, 'complete', 'actor-1');

      expect(result.intervention.status).toBe(InterventionStatus.COMPLETED);
      expect(result.event.type).toBe('intervention.completed');
    });

    it('should transition SCHEDULED -> CANCELLED with cancel action', async () => {
      const intervention = {
        id: '3',
        status: InterventionStatus.SCHEDULED,
        scheduledDate: new Date(),
        windowStart: new Date(),
        windowEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = await stateMachine.applyTransition(intervention, 'cancel', 'actor-1', 'Customer cancelled');

      expect(result.intervention.status).toBe(InterventionStatus.CANCELLED);
      expect(result.intervention.cancelledReason).toBe('Customer cancelled');
      expect(result.event.type).toBe('intervention.cancelled');
      expect(result.event.payload.reason).toBe('Customer cancelled');
    });

    it('should transition ARRIVED -> SCHEDULED with reschedule action', async () => {
      const intervention = {
        id: '4',
        status: InterventionStatus.ARRIVED,
        scheduledDate: new Date('2024-01-01'),
        windowStart: new Date('2024-01-01T10:00:00'),
        windowEnd: new Date('2024-01-01T12:00:00'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = await stateMachine.applyTransition(
        intervention,
        'reschedule',
        'actor-1',
        undefined,
        '2024-01-02',
        '2024-01-02T10:00:00',
        '2024-01-02T12:00:00',
      );

      expect(result.intervention.status).toBe(InterventionStatus.SCHEDULED);
      expect(result.intervention.scheduledDate).toEqual(new Date('2024-01-02'));
      expect(result.intervention.windowStart).toEqual(new Date('2024-01-02T10:00:00'));
      expect(result.intervention.windowEnd).toEqual(new Date('2024-01-02T12:00:00'));
      expect(result.event.type).toBe('intervention.scheduled');
      expect(result.event.payload.newScheduledDate).toBe('2024-01-02');
      expect(result.event.payload.newWindowStart).toBe('2024-01-02T10:00:00');
      expect(result.event.payload.newWindowEnd).toBe('2024-01-02T12:00:00');
    });

    it('should throw for invalid transitions', async () => {
      const intervention = {
        id: '5',
        status: InterventionStatus.EN_ROUTE,
        scheduledDate: new Date(),
        windowStart: new Date(),
        windowEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      await expect(stateMachine.applyTransition(intervention, 'complete', 'actor-1')).rejects.toThrow();
    });
  });

  describe('resolveConflict', () => {
    it('should allow valid transitions', () => {
      const intervention = {
        status: InterventionStatus.SCHEDULED,
        id: '1',
      } as any;
      expect(() => resolveConflict(intervention, 'en_route')).not.toThrow();
    });

    it('should throw ConflictException for COMPLETED -> any transition', () => {
      const intervention = {
        status: InterventionStatus.COMPLETED,
        id: '1',
      } as any;
      expect(() => resolveConflict(intervention, 'en_route')).toThrow(ConflictException);
      expect(() => resolveConflict(intervention, 'cancel')).toThrow(ConflictException);
      expect(() => resolveConflict(intervention, 'reschedule')).toThrow(ConflictException);
    });

    it('should throw ConflictException for CANCELLED -> any transition', () => {
      const intervention = {
        status: InterventionStatus.CANCELLED,
        id: '1',
      } as any;
      expect(() => resolveConflict(intervention, 'en_route')).toThrow(ConflictException);
      expect(() => resolveConflict(intervention, 'arrived')).toThrow(ConflictException);
      expect(() => resolveConflict(intervention, 'complete')).toThrow(ConflictException);
    });
  });

  describe('canPerformAction', () => {
    it('should return true for valid actions', () => {
      const intervention = { status: InterventionStatus.SCHEDULED, id: '1' } as any;
      expect(canPerformAction(intervention, 'en_route')).toBe(true);
      expect(canPerformAction(intervention, 'cancel')).toBe(true);
    });

    it('should return false for invalid actions', () => {
      const intervention = { status: InterventionStatus.COMPLETED, id: '1' } as any;
      expect(canPerformAction(intervention, 'en_route')).toBe(false);
      expect(canPerformAction(intervention, 'cancel')).toBe(false);
    });
  });
});

describe('State Transition Matrix', () => {
  const stateMachine = new InterventionStateMachine();

  const allStatuses = Object.values(InterventionStatus);

  describe('exhaustive transition tests', () => {
    allStatuses.forEach((fromStatus) => {
      const allowedTransitions = stateMachine.getValidTransitions(fromStatus);

      describe(`from ${fromStatus}`, () => {
        allowedTransitions.forEach((toStatus) => {
          it(`should allow transition to ${toStatus}`, () => {
            expect(stateMachine.canTransition(fromStatus, toStatus)).toBe(true);
          });
        });

        const invalidTransitions = allStatuses.filter((s) => s !== fromStatus && !allowedTransitions.includes(s));
        invalidTransitions.forEach((toStatus) => {
          it(`should not allow transition to ${toStatus}`, () => {
            expect(stateMachine.canTransition(fromStatus, toStatus)).toBe(false);
          });
        });
      });
    });
  });
});
