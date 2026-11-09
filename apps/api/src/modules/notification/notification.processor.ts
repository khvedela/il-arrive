import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NOTIFICATIONS_QUEUE, NotificationService, SEND_ATTEMPTS } from './notification.service';

const RECONCILE_EVERY_MS = 60_000;

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(private readonly notifications: NotificationService) {
    super();
  }

  onModuleInit() {
    // Recover rows committed but never enqueued (Redis down / crash after commit).
    this.timer = setInterval(() => void this.notifications.requeueStale().catch(() => undefined), RECONCILE_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async process(job: Job<{ notificationId: string }>): Promise<void> {
    const attempts = job.opts.attempts ?? SEND_ATTEMPTS;
    await this.notifications.deliver(job.data.notificationId, job.attemptsMade + 1 >= attempts);
  }
}
