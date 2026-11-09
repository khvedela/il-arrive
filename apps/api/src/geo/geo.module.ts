import { Injectable, Module, DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { appEnv } from '../../config/env.validation';
import { Geocoder } from './geocoder.interface';
import { BanGeocoder } from './providers/ban-geocoder.provider';

export const GEOCODER_TOKEN = 'GEOCODER';

@Injectable()
export class GeocoderService {
  private readonly geocoder: Geocoder;

  constructor(geocoder: Geocoder) {
    this.geocoder = geocoder;
  }

  async search(query: string): Promise<{ label: string; lat: number; lng: number; score: number; address?: { street?: string; city?: string; postcode?: string; country?: string } }[]> {
    return this.geocoder.search(query);
  }

  async autocomplete(query: string, limit?: number): Promise<{ label: string; lat: number; lng: number; score: number; address?: { street?: string; city?: string; postcode?: string; country?: string } }[]> {
    return this.geocoder.autocomplete(query, limit);
  }
}

@Injectable()
export class GeoConfigService {
  constructor(private configService: ConfigService) {}

  getGeocoder(): Geocoder {
    const provider = this.configService.get<AppEnvironment>('GEOCODING_PROVIDER') || 'ban';

    if (provider === 'ban') {
      return new BanGeocoder();
    }
    throw new Error(`Unsupported geocoding provider: ${provider}`);
  }

  validateEnvironment(): void {
    const provider = this.configService.get<AppEnvironment>('GEOCODING_PROVIDER') || 'ban';

    if (provider !== 'ban') {
      throw new Error(`Only BAN geocoding provider is supported in this version`);
    }
  }
}

export const geoProviders: Provider<Geocoder>[] = [
  {
    provide: GEOCODER_TOKEN,
    useFactory: (configService: ConfigService) => {
      const config = new GeoConfigService(configService);
      config.validateEnvironment();
      return config.getGeocoder();
    },
    inject: [ConfigService],
  },
];

@Module({
  imports: [ConfigModule],
  providers: [...geoProviders, GeoConfigService, BanGeocoder],
  exports: [...geoProviders, GeoConfigService],
})
export class GeoModule {
  static forRoot(): DynamicModule {
    return {
      module: GeoModule,
      providers: [...geoProviders, GeoConfigService],
      exports: [...geoProviders, GeoConfigService],
    };
  }
}
