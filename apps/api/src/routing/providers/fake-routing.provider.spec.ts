import { Test, TestingModule } from '@nestjs/testing';
import { FakeRoutingProvider } from './fake-routing.provider';

describe('FakeRoutingProvider', () => {
  let provider: FakeRoutingProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FakeRoutingProvider],
    }).compile();

    provider = module.get<FakeRoutingProvider>(FakeRoutingProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should return deterministic route for same inputs', async () => {
    const from = { lat: 48.8566, lng: 2.3522 };
    const to = { lat: 48.8606, lng: 2.3549 };

    const result1 = await provider.route(from, to);
    const result2 = await provider.route(from, to);

    expect(result1).toEqual(result2);
    expect(result1.source).toBe('fake');
    expect(result1.trafficAware).toBe(false);
  });

  it('should return reasonable route for Paris to Lyon', async () => {
    const from = { lat: 48.8566, lng: 2.3522 };
    const to = { lat: 45.7640, lng: 4.8357 };

    const result = await provider.route(from, to);

    expect(result.durationS).toBeGreaterThan(0);
    expect(result.distanceM).toBeGreaterThan(0);
    expect(result.source).toBe('fake');
    expect(result.trafficAware).toBe(false);
  });

  it('should return same result regardless of departAt', async () => {
    const from = { lat: 48.8566, lng: 2.3522 };
    const to = { lat: 48.8606, lng: 2.3549 };

    const result1 = await provider.route(from, to);
    const result2 = await provider.route(from, to);

    expect(result1).toEqual(result2);
  });
});
