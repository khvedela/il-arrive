import { ConfigService } from '@nestjs/config';
import { RoutingConfigService } from './routing.module';
import { FakeRoutingProvider } from './providers/fake-routing.provider';

const config = (env: Record<string, string>) => new RoutingConfigService({ get: (k: string) => env[k] } as unknown as ConfigService);

describe('routing provider configuration', () => {
  it('refuses the fake provider when NODE_ENV=production', () => {
    expect(() => config({ NODE_ENV: 'production', ROUTING_PROVIDER: 'fake' }).validateEnvironment()).toThrow(/not allowed in production/);
  });

  it('refuses the implicit default (fake) in production', () => {
    expect(() => config({ NODE_ENV: 'production' }).validateEnvironment()).toThrow(/not allowed in production/);
  });

  it('allows tomtom in production and fake elsewhere', () => {
    expect(() => config({ NODE_ENV: 'production', ROUTING_PROVIDER: 'tomtom' }).validateEnvironment()).not.toThrow();
    expect(() => config({ NODE_ENV: 'test', ROUTING_PROVIDER: 'fake' }).validateEnvironment()).not.toThrow();
    expect(config({ NODE_ENV: 'test' }).getProvider()).toBeInstanceOf(FakeRoutingProvider);
  });
});
