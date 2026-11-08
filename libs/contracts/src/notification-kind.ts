export const NotificationKind = {
  CONFIRMATION: 'CONFIRMATION',
  EN_ROUTE: 'EN_ROUTE',
  DELAY: 'DELAY',
  ETA_UPDATE: 'ETA_UPDATE',
  ARRIVED: 'ARRIVED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
} as const;

export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];
