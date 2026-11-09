import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationWorkerModule } from '../notification/notification.module';

@Module({
  imports: [
    ConfigModule,
    NotificationWorkerModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD', '') || undefined,
        },
      }),
    }),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class WorkerModule {}
