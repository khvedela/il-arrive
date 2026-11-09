import { Injectable } from '@nestjs/common';
import { NotificationService, RequestResult } from './notification.service';

/**
 * Domain events the intervention/tracking modules (SLA-8/9) publish. They call
 * `NotificationEventsService.handle()` from their event bus subscription.
 * Versions are derived from stable event data so redelivery is deduped.
 */
export type InterventionNotificationEvent =
  | { type: 'intervention.created'; interventionId: string }
  | { type: 'intervention.en_route'; interventionId: string; eta?: Date | null }
  | { type: 'intervention.delayed'; interventionId: string; delayMinutes: number; eta?: Date | null }
  | { type: 'intervention.eta.updated'; interventionId: string; eta: Date }
  | { type: 'intervention.arrived'; interventionId: string }
  | { type: 'intervention.cancelled'; interventionId: string }
  | { type: 'intervention.rescheduled'; interventionId: string; newWindowStart: Date };

@Injectable()
export class NotificationEventsService {
  constructor(private readonly notifications: NotificationService) {}

  handle(e: InterventionNotificationEvent, now = new Date()): Promise<RequestResult> {
    const id = e.interventionId;
    switch (e.type) {
      case 'intervention.created':
        return this.notifications.request({ interventionId: id, kind: 'CONFIRMATION', version: 1 }, now);
      case 'intervention.en_route':
        return this.notifications.request({ interventionId: id, kind: 'EN_ROUTE', version: 1, newEta: e.eta }, now);
      case 'intervention.delayed':
        return this.notifications.request(
          { interventionId: id, kind: 'DELAY', version: e.delayMinutes, newEta: e.eta },
          now,
        );
      case 'intervention.eta.updated':
        return this.notifications.request({ interventionId: id, kind: 'ETA_UPDATE', newEta: e.eta }, now);
      case 'intervention.arrived':
        return this.notifications.request({ interventionId: id, kind: 'ARRIVED', version: 1 }, now);
      case 'intervention.cancelled':
        return this.notifications.request({ interventionId: id, kind: 'CANCELLED', version: 1 }, now);
      case 'intervention.rescheduled':
        return this.notifications.request(
          { interventionId: id, kind: 'RESCHEDULED', version: e.newWindowStart.getTime() },
          now,
        );
    }
  }
}
