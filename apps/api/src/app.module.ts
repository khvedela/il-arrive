import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    DatabaseModule,
    HealthModule,
    AuthModule,
    BusinessModule,
    MembersModule,
    InterventionModule,
    TrackingModule,
    NotificationModule,
  ],
  providers: [RedisService],
})
export class AppModule {}
