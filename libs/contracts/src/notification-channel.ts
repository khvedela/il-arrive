export const NotificationChannel = {
  SMS: 'SMS',
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];
