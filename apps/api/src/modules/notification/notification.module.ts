import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleSmsProvider } from './providers/console-sms.provider';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
    ConfigModule,
  ],
  providers: [ConsoleSmsProvider],
  exports: [ConsoleSmsProvider],
})
export class NotificationModule {}
