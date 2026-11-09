import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TomTomRoutingProvider } from './tomtom-routing.provider';

describe('TomTomRoutingProvider', () => {
  let provider: TomTomRoutingProvider;
  let configService: ConfigService;

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'TOMTOM_API_KEY') return 'fake-key-for-testing';
      if (key === 'NODE_ENV') return 'development';
      return undefined;
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TomTomRoutingProvider,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    provider = module.get<TomTomRoutingProvider>(TomTomRoutingProvider);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should use fake key in development', () => {
    expect(configService.get('TOMTOM_API_KEY')).toBe('fake-key-for-testing');
  });

  describe('circuit breaker', () => {
    it('should open after failures', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      for (let i = 0; i < 5; i++) {
        try {
          await provider.route(
            { lat: 48.8566, lng: 2.3522 },
            { lat: 48.8606, lng: 2.3549 },
          );
        } catch {
          // ignore
        }
      }

      await expect(
        provider.route(
          { lat: 48.8566, lng: 2.3522 },
          { lat: 48.8606, lng: 2.3549 },
        ),
      ).rejects.toThrow('TomTom circuit breaker is open');

      global.fetch = originalFetch;
    });
  });

  describe('recorded HTTP fixtures (no real key needed)', () => {
    // Trimmed real response of GET /routing/1/calculateRoute/{from}:{to}/json?traffic=true
    const fixture = {
      formatVersion: '0.0.12',
      routes: [{ summary: { lengthInMeters: 6420, travelTimeInSeconds: 1105, trafficDelayInSeconds: 212, departureTime: '2026-11-09T10:00:00+01:00' } }],
    };
    const from = { lat: 48.8566, lng: 2.3522 };
    const to = { lat: 48.8606, lng: 2.3849 };
    const original = global.fetch;
    afterEach(() => {
      global.fetch = original;
    });

    it('maps a recorded response to a traffic-aware RouteResult and calls the calculateRoute endpoint', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => fixture });
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(provider.route(from, to)).resolves.toEqual({ durationS: 1105, distanceM: 6420, trafficAware: true, source: 'tomtom' });

      const url = new URL(fetchMock.mock.calls[0][0] as string);
      expect(url.pathname).toBe('/routing/1/calculateRoute/48.8566,2.3522:48.8606,2.3849/json');
      expect(url.searchParams.get('traffic')).toBe('true');
      expect(url.searchParams.get('key')).toBe('fake-key-for-testing');
    });

    it('retries transient failures then succeeds', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fixture });
      global.fetch = fetchMock as unknown as typeof fetch;
      await expect(provider.route(from, to)).resolves.toMatchObject({ durationS: 1105 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry a 403 and does not leak the key in the error', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 403 });
      global.fetch = fetchMock as unknown as typeof fetch;
      const err = await provider.route(from, to).catch((e: Error) => e);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect((err as Error).message).not.toContain('fake-key-for-testing');
    });

    it('rejects a response without a route summary', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ routes: [] }) }) as unknown as typeof fetch;
      await expect(provider.route(from, to)).rejects.toThrow('missing route summary');
    });

    it('half-opens after the cooldown', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('down')) as unknown as typeof fetch;
      for (let i = 0; i < 5; i++) await provider.route(from, to).catch(() => undefined);
      await expect(provider.route(from, to)).rejects.toThrow('circuit breaker is open');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => fixture }) as unknown as typeof fetch;
      await expect(provider.route(from, to)).resolves.toMatchObject({ durationS: 1105 });
      jest.restoreAllMocks();
    });
  });
});
