import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NOTIFICATIONS_QUEUE, NotificationService, SEND_ATTEMPTS } from './notification.service';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationService) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<void> {
    const attempts = job.opts.attempts ?? SEND_ATTEMPTS;
    await this.notifications.deliver(job.data.notificationId, job.attemptsMade + 1 >= attempts);
  }
}
