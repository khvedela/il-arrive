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

  describe('shouldRecompute', () => {
    it('should recompute on first call', () => {
      const should = policy.shouldRecompute(null, null, null, null, 48.8566, 2.3522);

      expect(should).toBe(true);
    });

    it('should recompute after 60 seconds', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 61000);

      const should = policy.shouldRecompute(past, past, 48.8566, 2.3522, 48.8566, 2.3522);

      expect(should).toBe(true);
    });

    it('should not recompute within 60 seconds', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 30000);

      const should = policy.shouldRecompute(past, past, 48.8566, 2.3522, 48.8566, 2.3522);

      expect(should).toBe(false);
    });

    it('should recompute after moving 500+ meters', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 120000);

      const should = policy.shouldRecompute(past, past, 48.8566, 2.3522, 48.8700, 2.3700);

      expect(should).toBe(true);
    });

    it('should not recompute after small movement', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 120000);

      const should = policy.shouldRecompute(past, past, 48.8566, 2.3522, 48.8567, 2.3523);

      expect(should).toBe(false);
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
