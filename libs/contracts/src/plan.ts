export const Plan = {
  TRIAL: 'TRIAL',
  SOLO: 'SOLO',
  EQUIPE: 'EQUIPE',
  BUSINESS: 'BUSINESS',
} as const;

export type Plan = (typeof Plan)[keyof typeof Plan];
