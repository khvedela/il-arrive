import type { NotificationChannel, NotificationKind, NotificationStatus } from './enums';

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  channel: NotificationChannel;
  to: string;
  body: string;
  status: NotificationStatus;
  attempts: number;
  createdAt: string;
}
