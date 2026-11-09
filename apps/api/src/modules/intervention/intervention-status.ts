export const InterventionStatus = {
  SCHEDULED: 'SCHEDULED',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type InterventionStatus = (typeof InterventionStatus)[keyof typeof InterventionStatus];
