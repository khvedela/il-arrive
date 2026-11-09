import { DEFAULT_PREFS, evaluateSmsPolicy, PolicyInput, resolvePrefs } from './sms-policy';

const T0 = new Date('2026-11-09T10:00:00Z');
const min = (n: number, from = T0) => new Date(from.getTime() + n * 60000);

const base = (o: Partial<PolicyInput> = {}): PolicyInput => ({
  kind: 'ETA_UPDATE',
  status: 'EN_ROUTE',
  prefs: DEFAULT_PREFS,
  sentCount: 1,
  lastSentAt: T0,
  lastNotifiedEta: min(30),
  newEta: min(50),
  quotaRemaining: 10,
  now: min(25),
  ...o,
});

describe('evaluateSmsPolicy', () => {
  it('allows an ETA update with Δ≥15 min and ≥20 min since the last SMS', () => {
    expect(evaluateSmsPolicy(base())).toEqual({ allow: true });
  });
  it.each([1, 5, 14])('rejects ETA jitter of %i min', (d) => {
    expect(evaluateSmsPolicy(base({ newEta: min(30 + d) }))).toEqual({
      allow: false,
      reason: 'eta_delta_below_threshold',
    });
  });
  it('rejects a large ETA change inside the 20 min window', () => {
    expect(evaluateSmsPolicy(base({ now: min(19) }))).toEqual({ allow: false, reason: 'eta_too_soon' });
  });
  it('allows exactly 15 min delta and 20 min gap', () => {
    expect(evaluateSmsPolicy(base({ newEta: min(45), now: min(20) })).allow).toBe(true);
  });
  it('rejects the 6th SMS', () => {
    expect(evaluateSmsPolicy(base({ kind: 'EN_ROUTE', sentCount: 5 }))).toEqual({
      allow: false,
      reason: 'max_sms_reached',
    });
  });
  it('rejects anything for a completed intervention, and non-cancel kinds when cancelled', () => {
    expect(evaluateSmsPolicy(base({ status: 'COMPLETED', kind: 'CANCELLED' })).allow).toBe(false);
    expect(evaluateSmsPolicy(base({ status: 'CANCELLED', kind: 'EN_ROUTE' })).allow).toBe(false);
    expect(evaluateSmsPolicy(base({ status: 'CANCELLED', kind: 'CANCELLED' })).allow).toBe(true);
  });
  it('respects per-business prefs, defaults CONFIRMATION/ARRIVED off', () => {
    expect(evaluateSmsPolicy(base({ kind: 'CONFIRMATION' }))).toEqual({ allow: false, reason: 'kind_disabled' });
    expect(evaluateSmsPolicy(base({ kind: 'CONFIRMATION', manual: true })).allow).toBe(true);
    const prefs = resolvePrefs({ ARRIVED: true, EN_ROUTE: false, junk: 1 });
    expect(prefs.ARRIVED).toBe(true);
    expect(prefs.EN_ROUTE).toBe(false);
    expect(prefs.DELAY).toBe(true);
  });
  it('rejects when over quota, even for manual sends', () => {
    expect(evaluateSmsPolicy(base({ quotaRemaining: 0, manual: true }))).toEqual({
      allow: false,
      reason: 'quota_exceeded',
    });
  });
});
