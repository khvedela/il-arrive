export const Role = {
  OWNER: 'OWNER',
  DISPATCHER: 'DISPATCHER',
  TECHNICIAN: 'TECHNICIAN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
