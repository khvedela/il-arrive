import { InterventionStatus, NotificationKind } from '@prisma/client';

export const ETA_MIN_DELTA_MINUTES = 15;
export const ETA_MIN_GAP_MINUTES = 20;
export const MAX_SMS_PER_INTERVENTION = 5;

export type NotificationPrefs = Record<NotificationKind, boolean>;

export const DEFAULT_PREFS: NotificationPrefs = {
  CONFIRMATION: false,
  EN_ROUTE: true,
  DELAY: true,
  ETA_UPDATE: true,
  ARRIVED: false,
  CANCELLED: true,
  RESCHEDULED: true,
};

export function resolvePrefs(raw: unknown): NotificationPrefs {
  const prefs = { ...DEFAULT_PREFS };
  if (raw && typeof raw === 'object') {
    for (const kind of Object.keys(DEFAULT_PREFS) as NotificationKind[]) {
      const v = (raw as Record<string, unknown>)[kind];
      if (typeof v === 'boolean') prefs[kind] = v;
    }
  }
  return prefs;
}

export type SkipReason =
  | 'terminal_intervention'
  | 'kind_disabled'
  | 'max_sms_reached'
  | 'eta_delta_below_threshold'
  | 'eta_too_soon'
  | 'quota_exceeded';

export interface PolicyInput {
  kind: NotificationKind;
  status: InterventionStatus;
  prefs: NotificationPrefs;
  /** Non-failed SMS already created for this intervention. */
  sentCount: number;
  lastSentAt: Date | null;
  lastNotifiedEta: Date | null;
  newEta: Date | null;
  quotaRemaining: number;
  now: Date;
  /** Manual dashboard send: bypasses prefs and ETA thresholds only. */
  manual?: boolean;
}

export type PolicyDecision = { allow: true } | { allow: false; reason: SkipReason };

const deny = (reason: SkipReason): PolicyDecision => ({ allow: false, reason });

export function evaluateSmsPolicy(i: PolicyInput): PolicyDecision {
  // Terminal guard: a cancelled intervention only gets its CANCELLED notice.
  if (i.status === 'COMPLETED') return deny('terminal_intervention');
  if (i.status === 'CANCELLED' && i.kind !== 'CANCELLED') return deny('terminal_intervention');

  if (!i.manual && !i.prefs[i.kind]) return deny('kind_disabled');
  if (i.sentCount >= MAX_SMS_PER_INTERVENTION) return deny('max_sms_reached');

  if (i.kind === 'ETA_UPDATE' && !i.manual) {
    if (i.lastNotifiedEta && i.newEta) {
      const deltaMin = Math.abs(i.newEta.getTime() - i.lastNotifiedEta.getTime()) / 60000;
      if (deltaMin < ETA_MIN_DELTA_MINUTES) return deny('eta_delta_below_threshold');
    }
    if (i.lastSentAt) {
      const gapMin = (i.now.getTime() - i.lastSentAt.getTime()) / 60000;
      if (gapMin < ETA_MIN_GAP_MINUTES) return deny('eta_too_soon');
    }
  }

  if (i.quotaRemaining <= 0) return deny('quota_exceeded');
  return { allow: true };
}

export function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
