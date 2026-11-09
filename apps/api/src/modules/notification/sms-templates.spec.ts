import { formatEtaFr, gsm7Length, renderSms } from './sms-templates';
import { parsePhone } from './phone';

describe('sms templates', () => {
  const p = { businessName: 'Plomberie Martin', trackingLink: 'https://t.ilarrive.fr/t/abc', technicianFirstName: 'Marc' };

  it('formats ETA in Europe/Paris as "10h42"', () => {
    expect(formatEtaFr(new Date('2026-11-09T09:42:00Z'))).toBe('10h42');
    expect(formatEtaFr(new Date('2026-07-09T08:05:00Z'))).toBe('10h05');
  });
  it('renders EN_ROUTE with technician, business, eta and link', () => {
    const r = renderSms('EN_ROUTE', { ...p, eta: new Date('2026-11-09T09:42:00Z') });
    expect(r.body).toBe(
      'Marc (Plomberie Martin) est en route. Arrivée estimée vers 10h42. Suivi : https://t.ilarrive.fr/t/abc',
    );
    expect(r.warning).toBe(false);
  });
  it('warns above 160 GSM-7 chars and when non-GSM chars force UCS-2', () => {
    expect(renderSms('EN_ROUTE', { ...p, businessName: 'X'.repeat(150) }).warning).toBe(true);
    expect(gsm7Length('abc€')).toBe(5);
    expect(gsm7Length('hé 😀')).toBeNull();
  });
});

describe('parsePhone', () => {
  it('normalises FR national numbers to E.164', () => {
    expect(parsePhone('06 12 34 56 78')?.e164).toBe('+33612345678');
  });
  it('accepts international numbers', () => {
    expect(parsePhone('+44 7911 123456')?.e164).toBe('+447911123456');
  });
  it('rejects garbage', () => {
    expect(parsePhone('12')).toBeNull();
  });
});
