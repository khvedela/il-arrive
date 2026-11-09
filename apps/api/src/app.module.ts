import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { config } from './config';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { InterventionModule } from './modules/intervention/intervention.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { NotificationModule } from './modules/notification/notification.module';
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
    HealthModule,
    AuthModule,
    InterventionModule,
    TrackingModule,
    NotificationModule,
    RoutingModule.forRoot(),
    GeoModule.forRoot(),
    ETAModule,
  ],
  providers: [PrismaService, RedisService],
})
export class AppModule {}
