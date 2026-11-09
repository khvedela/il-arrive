import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { config } from './config';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { InterventionModule } from './modules/intervention/intervention.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DevModule } from './modules/dev/dev.module';

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
    HealthModule,
    AuthModule,
    InterventionModule,
    TrackingModule,
    NotificationModule,
    DevModule,
  ],
  providers: [PrismaService, RedisService],
})
export class AppModule {}
