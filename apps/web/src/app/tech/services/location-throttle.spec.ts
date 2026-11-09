import { LocationThrottle, distanceMeters, type LocationFix } from './location-throttle';

const fix = (lat: number, lng: number, accuracy = 20): LocationFix => ({ lat, lng, accuracy, timestamp: 0 });

describe('LocationThrottle', () => {
  it('sends the first good fix', () => {
    expect(new LocationThrottle().shouldSend(fix(48.85, 2.35), 0)).toBe(true);
  });

  it('drops fixes with accuracy > 200 m', () => {
    const t = new LocationThrottle();
    expect(t.shouldSend(fix(48.85, 2.35, 201), 0)).toBe(false);
    expect(t.shouldSend(fix(48.85, 2.35, 200), 0)).toBe(true);
    expect(t.shouldSend(fix(48.85, 2.35, NaN), 0)).toBe(false);
  });

  it('throttles to one fix per 20 s when not moving', () => {
    const t = new LocationThrottle();
    const f = fix(48.85, 2.35);
    t.markSent(f, 0);
    expect(t.shouldSend(f, 10_000)).toBe(false);
    expect(t.shouldSend(f, 19_999)).toBe(false);
    expect(t.shouldSend(f, 20_000)).toBe(true);
  });

  it('sends early when moved > 150 m', () => {
    const t = new LocationThrottle();
    t.markSent(fix(48.85, 2.35), 0);
    expect(distanceMeters(fix(48.85, 2.35), fix(48.8514, 2.35))).toBeGreaterThan(150);
    expect(t.shouldSend(fix(48.8514, 2.35), 5_000)).toBe(true);
    expect(t.shouldSend(fix(48.8505, 2.35), 5_000)).toBe(false);
  });

  it('does not let a dropped inaccurate fix reset the window', () => {
    const t = new LocationThrottle();
    t.markSent(fix(48.85, 2.35), 0);
    expect(t.shouldSend(fix(48.9, 2.4, 500), 5_000)).toBe(false);
    expect(t.shouldSend(fix(48.85, 2.35), 20_000)).toBe(true);
  });

  it('reset clears state', () => {
    const t = new LocationThrottle();
    t.markSent(fix(48.85, 2.35), 0);
    t.reset();
    expect(t.shouldSend(fix(48.85, 2.35), 1)).toBe(true);
  });
});
