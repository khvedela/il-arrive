import { NotificationKind } from '@prisma/client';

export interface TemplateParams {
  businessName: string;
  trackingLink: string;
  technicianFirstName?: string | null;
  eta?: Date | null;
  delayMinutes?: number | null;
  timezone?: string;
}

export interface RenderedSms {
  body: string;
  length: number;
  segments: number;
  /** True when longer than a single 160-char GSM-7 SMS (or not GSM-7 encodable). */
  warning: boolean;
}

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXT = '^{}\\[~]|€\f';

/** Septets needed for GSM-7, or null if the text needs UCS-2. */
export function gsm7Length(text: string): number | null {
  let n = 0;
  for (const ch of text) {
    if (GSM7_BASIC.includes(ch)) n += 1;
    else if (GSM7_EXT.includes(ch)) n += 2;
    else return null;
  }
  return n;
}

export function formatEtaFr(eta: Date, timezone = 'Europe/Paris'): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(eta);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${Number(h)}h${m}`;
}

export function renderSms(kind: NotificationKind, p: TemplateParams): RenderedSms {
  const who = p.technicianFirstName
    ? `${p.technicianFirstName} (${p.businessName})`
    : p.businessName;
  const eta = p.eta ? formatEtaFr(p.eta, p.timezone) : null;
  const etaPart = eta ? ` Arrivée estimée vers ${eta}.` : '';
  let body: string;
  switch (kind) {
    case 'CONFIRMATION':
      body = `${p.businessName} : votre intervention est confirmée. Suivi : ${p.trackingLink}`;
      break;
    case 'EN_ROUTE':
      body = `${who} est en route.${etaPart} Suivi : ${p.trackingLink}`;
      break;
    case 'DELAY':
      body = `${p.businessName} : ${p.technicianFirstName ?? 'le technicien'} a du retard${
        p.delayMinutes ? ` (environ ${p.delayMinutes} min)` : ''
      }.${etaPart} Suivi : ${p.trackingLink}`;
      break;
    case 'ETA_UPDATE':
      body = `${p.businessName} : nouvelle heure d'arrivée estimée${eta ? ` vers ${eta}` : ''}. Suivi : ${p.trackingLink}`;
      break;
    case 'ARRIVED':
      body = `${who} est arrivé. Suivi : ${p.trackingLink}`;
      break;
    case 'CANCELLED':
      body = `${p.businessName} : votre intervention est annulée. Nous vous recontactons. Détails : ${p.trackingLink}`;
      break;
    case 'RESCHEDULED':
      body = `${p.businessName} : votre intervention est reportée. Nouveau créneau : ${p.trackingLink}`;
      break;
  }
  const septets = gsm7Length(body);
  const length = septets ?? [...body].length;
  const single = septets !== null ? 160 : 70;
  const multi = septets !== null ? 153 : 67;
  return {
    body,
    length,
    segments: length <= single ? 1 : Math.ceil(length / multi),
    warning: length > single,
  };
}
