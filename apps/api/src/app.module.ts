import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { config } from './config';
import { DatabaseModule } from './common/database.module';
import { RedisService } from './common/redis.service';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessModule } from './modules/business/business.module';
import { MembersModule } from './modules/members/members.module';
import { InterventionModule } from './modules/intervention/intervention.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DevModule } from './modules/dev/dev.module';
import { RoutingModule } from './routing/routing.module';
import { GeoModule } from './geo/geo.module';
import { ETAModule } from './eta/eta.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ...config,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        connection: {
          host: c.get('REDIS_HOST', 'localhost'),
          port: c.get('REDIS_PORT', 6379),
          password: c.get('REDIS_PASSWORD', '') || undefined,
        },
      }),
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    BusinessModule,
    MembersModule,
    InterventionModule,
    TrackingModule,
    NotificationModule,
    DevModule,
    RoutingModule.forRoot(),
    GeoModule.forRoot(),
    ETAModule,
  ],
  providers: [RedisService],
})
export class AppModule {}
