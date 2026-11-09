import { Injectable, Module, DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../modules/auth/auth.module';
import { RedisService } from '../common/redis.service';
import { GEOCODER_TOKEN, Geocoder } from './geocoder.interface';
import { GeoCacheService } from './geo.cache.service';
import { GeoController } from './geo.controller';
import { BanGeocoder } from './providers/ban-geocoder.provider';

export { GEOCODER_TOKEN };

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
    const provider = this.configService.get<string>('GEOCODING_PROVIDER') || 'ban';

    if (provider === 'ban') {
      return new BanGeocoder();
    }
    throw new Error(`Unsupported geocoding provider: ${provider}`);
  }

  validateEnvironment(): void {
    const provider = this.configService.get<string>('GEOCODING_PROVIDER') || 'ban';

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
  imports: [ConfigModule, AuthModule],
  controllers: [GeoController],
  providers: [...geoProviders, GeoConfigService, BanGeocoder, GeoCacheService, RedisService],
  exports: [...geoProviders, GeoConfigService],
})
export class GeoModule {
  static forRoot(): DynamicModule {
    return {
      module: GeoModule,
      imports: [ConfigModule, AuthModule],
      controllers: [GeoController],
      providers: [...geoProviders, GeoConfigService, GeoCacheService, RedisService],
      exports: [...geoProviders, GeoConfigService],
    };
  }
}
