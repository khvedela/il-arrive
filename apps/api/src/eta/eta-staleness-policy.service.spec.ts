import { Test, TestingModule } from '@nestjs/testing';
import { ETAStalenessPolicyService } from './eta-staleness-policy.service';

describe('ETAStalenessPolicyService', () => {
  let policy: ETAStalenessPolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ETAStalenessPolicyService],
    }).compile();

    policy = module.get<ETAStalenessPolicyService>(ETAStalenessPolicyService);
  });

  it('should be defined', () => {
    expect(policy).toBeDefined();
  });

  describe('roundPosition', () => {
    it('should round to 4 decimal places', () => {
      const result = policy.roundPosition(48.8564789, 2.3546789);

      expect(result.lat).toBe(48.8565);
      expect(result.lng).toBe(2.3547);
    });

    it('should preserve negative coordinates', () => {
      const result = policy.roundPosition(-48.8564789, -2.3546789);

      expect(result.lat).toBe(-48.8565);
      expect(result.lng).toBe(-2.3547);
    });
  });

  describe('validateFix', () => {
    it('should accept valid fix', () => {
      const now = new Date();
      const result = policy.validateFix(48.8566, 2.3522, 100, now);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject high accuracy', () => {
      const now = new Date();
      const result = policy.validateFix(48.8566, 2.3522, 250, now);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Accuracy too low');
    });

    it('should reject future timestamp', () => {
      const future = new Date(Date.now() + 60000);
      const result = policy.validateFix(48.8566, 2.3522, 100, future);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Timestamp is in the future');
    });

    it('should reject old timestamp', () => {
      const old = new Date(Date.now() - 600000);
      const result = policy.validateFix(48.8566, 2.3522, 100, old);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Timestamp too old');
    });
  });

  describe('shouldRecompute (fake clock)', () => {
    const now = new Date('2026-01-01T10:00:00Z');
    const ago = (s: number) => new Date(now.getTime() - s * 1000);
    const P = { lat: 48.8566, lng: 2.3522 };
    const FAR = { lat: 48.87, lng: 2.37 }; // ~2 km
    const NEAR = { lat: 48.8567, lng: 2.3523 }; // ~13 m

    it('recomputes on first call', () => {
      expect(policy.shouldRecompute(null, null, null, null, P.lat, P.lng, now)).toBe(true);
    });

    it('never recomputes within 60 s, even after a large move (1 call/min cap)', () => {
      expect(policy.shouldRecompute(ago(59), ago(59), P.lat, P.lng, FAR.lat, FAR.lng, now)).toBe(false);
    });

    it('recomputes at exactly 60 s when moved > 500 m', () => {
      expect(policy.shouldRecompute(ago(60), ago(60), P.lat, P.lng, FAR.lat, FAR.lng, now)).toBe(true);
    });

    it('does not recompute after >= 60 s when barely moved and the ETA is younger than 3 min', () => {
      expect(policy.shouldRecompute(ago(120), ago(120), P.lat, P.lng, NEAR.lat, NEAR.lng, now)).toBe(false);
      expect(policy.shouldRecompute(ago(180), ago(180), P.lat, P.lng, NEAR.lat, NEAR.lng, now)).toBe(false);
    });

    it('recomputes without moving once the ETA is older than 3 min', () => {
      expect(policy.shouldRecompute(ago(181), ago(181), P.lat, P.lng, NEAR.lat, NEAR.lng, now)).toBe(true);
    });

    it('treats a 0 coordinate as a real coordinate, not as missing', () => {
      expect(policy.shouldRecompute(ago(120), ago(120), 0, 0, 0, 0.0001, now)).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return UNAVAILABLE when no fix', () => {
      const status = policy.getStatus(new Date(), new Date(), null);

      expect(status.status).toBe('UNAVAILABLE');
      expect(status.lastFixAt).toBeNull();
    });

    it('should return LIVE when fix is fresh', () => {
      const now = new Date();
      const fixAt = new Date(now.getTime() - 30000);

      const status = policy.getStatus(new Date(), new Date(), fixAt);

      expect(status.status).toBe('LIVE');
      expect(status.lastFixAt).toBeDefined();
    });

    it('should return STALE when fix is old', () => {
      const now = new Date();
      const fixAt = new Date(now.getTime() - 150000);

      const status = policy.getStatus(new Date(), new Date(), fixAt);

      expect(status.status).toBe('STALE');
      expect(status.lastFixAt).toBeDefined();
    });
  });

  describe('checkSessionExpiry', () => {
    it('should not expire session within 3 hours', () => {
      const startedAt = new Date(Date.now() - 2 * 3600000);
      const now = new Date();

      const result = policy.checkSessionExpiry(startedAt, now, now);

      expect(result.expired).toBe(false);
      expect(result.endedAt).toBeNull();
    });

    it('should expire session after 3 hours', () => {
      const startedAt = new Date(Date.now() - 4 * 3600000);
      const now = new Date();

      const result = policy.checkSessionExpiry(startedAt, now, now);

      expect(result.expired).toBe(true);
      expect(result.reason).toContain('3');
      expect(result.endedAt).toBeDefined();
    });
  });
});
