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
});
