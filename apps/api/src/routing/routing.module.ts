import { Injectable, Module, DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { appEnv, AppEnvironment } from '../../config/env.validation';
import { RoutingProvider } from './routing.interface';
import { FakeRoutingProvider } from './providers/fake-routing.provider';
import { TomTomRoutingProvider } from './providers/tomtom-routing.provider';

export const ROUTING_PROVIDER_TOKEN = 'ROUTING_PROVIDER';

@Injectable()
export class RoutingServiceProvider implements RoutingProvider {
  private readonly provider: RoutingProvider;

  constructor(provider: RoutingProvider) {
    this.provider = provider;
  }

  async route(from: { lat: number; lng: number }, to: { lat: number; lng: number }, options?: { departAt?: Date }): Promise<{ durationS: number; distanceM: number; trafficAware: boolean; source: string }> {
    return this.provider.route(from, to, options);
  }
}

@Injectable()
export class RoutingConfigService {
  constructor(private configService: ConfigService) {}

  getProvider(): RoutingProvider {
    const env = this.configService.get<AppEnvironment>('ROUTING_PROVIDER') || 'fake';

    if (env === 'tomtom') {
      return new TomTomRoutingProvider(this.configService);
    }
    return new FakeRoutingProvider();
  }

  validateEnvironment(): void {
    const env = this.configService.get<AppEnvironment>('NODE_ENV') || 'development';
    const provider = this.configService.get<AppEnvironment>('ROUTING_PROVIDER') || 'fake';

    if (provider === 'fake' && env === 'production') {
      throw new Error('Fake routing provider is not allowed in production');
    }
  }
}

export const routingProviders: Provider<RoutingProvider>[] = [
  {
    provide: ROUTING_PROVIDER_TOKEN,
    useFactory: (configService: ConfigService) => {
      const config = new RoutingConfigService(configService);
      config.validateEnvironment();
      return config.getProvider();
    },
    inject: [ConfigService],
  },
];

@Module({
  imports: [ConfigModule],
  providers: [...routingProviders, RoutingConfigService, TomTomRoutingProvider, FakeRoutingProvider],
  exports: [...routingProviders, RoutingConfigService],
})
export class RoutingModule {
  static forRoot(): DynamicModule {
    return {
      module: RoutingModule,
      providers: [...routingProviders, RoutingConfigService],
      exports: [...routingProviders, RoutingConfigService],
    };
  }
}
