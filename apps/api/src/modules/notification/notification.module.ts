import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../common/database.module';
import { AuthModule } from '../auth/auth.module';
import { InterventionModule } from '../intervention/intervention.module';
import { NotificationEventSubscriber } from './notification-event-subscriber';
import { ConsoleSmsProvider } from './providers/console-sms.provider';
import { SMS_PROVIDER } from './sms-provider';
import { NotificationService, NOTIFICATIONS_QUEUE } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationEventsService } from './notification-events.service';
import { NotificationProcessor } from './notification.processor';
import { TrackingLinkService } from './tracking-link.service';

const shared = [
  TrackingLinkService,
  NotificationService,
  NotificationEventsService,
  { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider },
];

/** API process: enqueues notifications, serves endpoints. */
@Module({
  imports: [DatabaseModule, AuthModule, InterventionModule, ConfigModule, BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  controllers: [NotificationController],
  providers: shared,
  exports: [NotificationService, NotificationEventsService],
})
export class NotificationModule {}

/** Worker process: consumes the `notifications` queue. */
@Module({
  imports: [DatabaseModule, AuthModule, InterventionModule, ConfigModule, BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  providers: [...shared, NotificationProcessor, NotificationEventSubscriber],
  exports: [NotificationService, NotificationEventsService],
})
export class NotificationWorkerModule {}
