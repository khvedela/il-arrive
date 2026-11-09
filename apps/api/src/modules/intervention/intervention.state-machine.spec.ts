import { InterventionStatus } from '@prisma/client';
import {
  EVENT_TYPES,
  TRANSITION_ACTIONS,
  TransitionActionType,
  allowedActions,
  transition,
} from './intervention.state-machine';

const STATUSES = Object.values(InterventionStatus) as InterventionStatus[];
const NOW = new Date('2026-01-10T10:00:00Z');

const base = (status: InterventionStatus) => ({
  status,
  scheduledDate: new Date('2026-01-10T00:00:00Z'),
  windowStart: new Date('2026-01-10T09:00:00Z'),
  windowEnd: new Date('2026-01-10T11:00:00Z'),
});

const params = {
  reason: 'customer asked',
  newScheduledDate: new Date('2026-01-11T00:00:00Z'),
  newWindowStart: new Date('2026-01-11T09:00:00Z'),
  newWindowEnd: new Date('2026-01-11T11:00:00Z'),
  now: NOW,
};

/** Expected outcome of every (status, action) pair per docs/ARCHITECTURE.md §3. */
const EXPECTED: Record<InterventionStatus, Partial<Record<TransitionActionType, InterventionStatus>>> = {
  SCHEDULED: { en_route: 'EN_ROUTE', cancel: 'CANCELLED', reschedule: 'SCHEDULED' },
  EN_ROUTE: { arrived: 'ARRIVED', stop_route: 'SCHEDULED', cancel: 'CANCELLED', reschedule: 'SCHEDULED' },
  ARRIVED: { complete: 'COMPLETED', cancel: 'CANCELLED' },
  COMPLETED: {},
  CANCELLED: {},
};

describe('transition()', () => {
  describe.each(STATUSES)('from %s', (from) => {
    it.each(TRANSITION_ACTIONS)('%s', (action) => {
      const result = transition(base(from), action, 'actor-1', params);
      const expectedTo = EXPECTED[from][action];
      if (expectedTo) {
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.from).toBe(from);
        expect(result.to).toBe(expectedTo);
        expect(result.patch.status).toBe(expectedTo);
        expect(result.event.type).toBe(EVENT_TYPES[action]);
        expect(result.event.payload).toMatchObject({ actorId: 'actor-1', action, fromStatus: from, toStatus: expectedTo });
      } else {
        expect(result).toMatchObject({ ok: false, error: 'INVALID_TRANSITION' });
      }
    });
  });

  it('allowedActions mirrors the table', () => {
    for (const s of STATUSES) {
      expect(allowedActions(s).sort()).toEqual(Object.keys(EXPECTED[s]).sort());
    }
  });

  it('stop_route returns to SCHEDULED (an action, not a status)', () => {
    expect((STATUSES as string[]).includes('stop_route')).toBe(false);
    const r = transition(base('EN_ROUTE'), 'stop_route', 'a');
    expect(r).toMatchObject({ ok: true, to: 'SCHEDULED', patch: { status: 'SCHEDULED', delayMinutes: null } });
  });

  it('cancel requires a reason and stores it', () => {
    expect(transition(base('SCHEDULED'), 'cancel', 'a', {})).toMatchObject({ ok: false, error: 'INVALID_PARAMS' });
    const r = transition(base('ARRIVED'), 'cancel', 'a', { reason: ' no access ' });
    expect(r).toMatchObject({ ok: true, patch: { cancelledReason: 'no access' } });
  });

  it('complete stamps completedAt', () => {
    expect(transition(base('ARRIVED'), 'complete', 'a', { now: NOW })).toMatchObject({
      ok: true,
      patch: { completedAt: NOW },
    });
  });

  it('reschedule applies the new window and validates it', () => {
    const ok = transition(base('EN_ROUTE'), 'reschedule', 'a', params);
    expect(ok).toMatchObject({ ok: true, patch: { windowStart: params.newWindowStart, windowEnd: params.newWindowEnd } });
    expect(transition(base('SCHEDULED'), 'reschedule', 'a', {})).toMatchObject({ ok: false, error: 'INVALID_PARAMS' });
    expect(
      transition(base('SCHEDULED'), 'reschedule', 'a', { ...params, newWindowEnd: params.newWindowStart }),
    ).toMatchObject({ ok: false, error: 'INVALID_PARAMS' });
  });

  it('does not mutate its input', () => {
    const input = base('SCHEDULED');
    const snapshot = JSON.stringify(input);
    transition(input, 'en_route', 'a');
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
