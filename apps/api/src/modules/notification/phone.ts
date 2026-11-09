import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface ParsedPhone {
  e164: string;
  national: string;
}

/** Parses to E.164 (default region FR, international numbers accepted). */
export function parsePhone(input: string, defaultRegion: 'FR' = 'FR'): ParsedPhone | null {
  const p = parsePhoneNumberFromString(input.trim(), defaultRegion);
  if (!p || !p.isValid()) return null;
  return { e164: p.number, national: p.formatNational() };
}
