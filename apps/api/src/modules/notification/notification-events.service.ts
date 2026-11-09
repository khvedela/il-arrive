import { Injectable } from '@nestjs/common';
import { NotificationService, RequestResult } from './notification.service';

/**
 * Domain events consumed from the persisted intervention timeline. SLA-9 may also
 * call handle() with the same stable event ID. Redelivery is deduped.
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

  handle(e: InterventionNotificationEvent, now = new Date(), eventId?: string): Promise<RequestResult> {
    const id = e.interventionId;
    switch (e.type) {
      case 'intervention.created':
        return this.notifications.request({ interventionId: id, kind: 'CONFIRMATION', version: eventId ?? 1 }, now);
      case 'intervention.en_route':
        return this.notifications.request({ interventionId: id, kind: 'EN_ROUTE', version: eventId ?? 1, newEta: e.eta }, now);
      case 'intervention.delayed':
        return this.notifications.request(
          { interventionId: id, kind: 'DELAY', version: eventId ?? e.delayMinutes, newEta: e.eta },
          now,
        );
      case 'intervention.eta.updated':
        return this.notifications.request({ interventionId: id, kind: 'ETA_UPDATE', version: eventId, newEta: e.eta }, now);
      case 'intervention.arrived':
        return this.notifications.request({ interventionId: id, kind: 'ARRIVED', version: eventId ?? 1 }, now);
      case 'intervention.cancelled':
        return this.notifications.request({ interventionId: id, kind: 'CANCELLED', version: eventId ?? 1 }, now);
      case 'intervention.rescheduled':
        return this.notifications.request(
          { interventionId: id, kind: 'RESCHEDULED', version: eventId ?? e.newWindowStart.getTime() },
          now,
        );
    }
  }
}
