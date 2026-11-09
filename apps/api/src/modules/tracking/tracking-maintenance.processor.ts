import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SWEEP_EVERY_MS, TrackingMaintenanceService } from './tracking-maintenance.service';
import { TRACKING_QUEUE } from './tracking.keys';

/** Registers the repeatable sweep job (idempotent: one scheduler id, upserted by any process). */
@Injectable()
export class TrackingScheduler implements OnModuleInit {
  constructor(@InjectQueue(TRACKING_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler('tracking-sweep', { every: SWEEP_EVERY_MS }, { name: 'sweep' });
  }
}

@Processor(TRACKING_QUEUE)
export class TrackingMaintenanceProcessor extends WorkerHost {
  constructor(private readonly maintenance: TrackingMaintenanceService) {
    super();
  }

  async process(): Promise<void> {
    await this.maintenance.sweep();
  }
}
