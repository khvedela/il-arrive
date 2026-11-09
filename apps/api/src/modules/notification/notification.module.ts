import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { ConsoleSmsProvider } from './providers/console-sms.provider';
import { SMS_PROVIDER } from './sms-provider';
import { NotificationService, NOTIFICATIONS_QUEUE } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationProcessor } from './notification.processor';
import { TrackingLinkService } from './tracking-link.service';

const shared = [
  PrismaService,
  TrackingLinkService,
  NotificationService,
  { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider },
];

/** API process: enqueues notifications, serves endpoints. */
@Module({
  imports: [ConfigModule, BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  controllers: [NotificationController],
  providers: shared,
  exports: [NotificationService],
})
export class NotificationModule {}

/** Worker process: consumes the `notifications` queue. */
@Module({
  imports: [ConfigModule, BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  providers: [...shared, NotificationProcessor],
})
export class NotificationWorkerModule {}
