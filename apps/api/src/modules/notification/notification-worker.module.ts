import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationService } from './services/notification.service';
import { ConsoleSmsProvider } from './providers/console-sms.provider';
import { SmsPolicyService } from './services/sms-policy.service';
import { SmsTemplatesService } from './services/sms-templates.service';
import { PhoneFormatterService } from './services/phone-formatter.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
    ConfigModule,
  ],
  providers: [
    ConsoleSmsProvider,
    NotificationService,
    SmsPolicyService,
    SmsTemplatesService,
    PhoneFormatterService,
  ],
  exports: [
    ConsoleSmsProvider,
    NotificationService,
    SmsPolicyService,
    SmsTemplatesService,
    PhoneFormatterService,
  ],
})
export class NotificationWorkerModule {}
