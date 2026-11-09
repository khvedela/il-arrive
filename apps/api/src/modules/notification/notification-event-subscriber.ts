import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { InterventionNotificationEvent, NotificationEventsService } from './notification-events.service';

/** Durable subscription to SLA-8's timeline. A crash before acknowledgement replays safely. */
@Injectable()
export class NotificationEventSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEventSubscriber.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(private readonly prisma: PrismaService, private readonly events: NotificationEventsService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.drain(), 1000);
    this.timer.unref();
    void this.drain();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }

  drain(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.consume().catch((e: unknown) => {
      this.logger.error(e instanceof Error ? e.message : 'notification event read failed');
    }).finally(() => { this.running = undefined; });
    return this.running;
  }

  private async consume() {
    const pending = await this.prisma.interventionEvent.findMany({
      where: { notificationProcessedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100,
    });
    for (const row of pending) {
      try {
        const payload = row.payload as Record<string, unknown>;
        const date = (v: unknown): Date | undefined => {
          if (typeof v !== 'string') return undefined;
          const d = new Date(v);
          return Number.isNaN(d.getTime()) ? undefined : d;
        };
        const base = { interventionId: row.interventionId };
        let event: InterventionNotificationEvent | undefined;
        switch (row.type) {
          case 'intervention.created': case 'intervention.arrived': case 'intervention.cancelled':
            event = { ...base, type: row.type }; break;
          case 'intervention.en_route': {
            const session = await this.prisma.trackingSession.findUnique({ where: { interventionId: row.interventionId }, select: { etaAt: true } });
            event = { ...base, type: row.type, eta: date(payload.eta ?? payload.etaAt) ?? session?.etaAt }; break;
          }
          case 'intervention.delayed':
            event = { ...base, type: row.type, delayMinutes: Number(payload.delayMinutes), eta: date(payload.eta ?? payload.etaAt) }; break;
          case 'intervention.eta.updated': {
            const eta = date(payload.eta ?? payload.etaAt);
            if (!eta) throw new Error(`invalid ETA event ${row.id}`);
            event = { ...base, type: row.type, eta }; break;
          }
          case 'intervention.rescheduled': {
            const newWindowStart = date(payload.newWindowStart);
            if (!newWindowStart) throw new Error(`invalid reschedule event ${row.id}`);
            event = { ...base, type: row.type, newWindowStart }; break;
          }
        }
        // Stable timeline ID distinguishes two separate en-route/delay cycles.
        if (event) await this.events.handle(event, new Date(), row.id);
        await this.prisma.interventionEvent.update({
          where: { id: row.id }, data: { notificationProcessedAt: new Date() },
        });
      } catch (e) {
        this.logger.error(`notification event ${row.id} remains pending: ${e instanceof Error ? e.message : 'error'}`);
      }
    }
  }
}
