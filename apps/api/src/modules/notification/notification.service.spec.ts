/* eslint-disable @typescript-eslint/no-explicit-any -- in-memory Prisma fake */
import { NotificationService } from './notification.service';
import { ConsoleSmsProvider } from './providers/console-sms.provider';

const T0 = new Date('2026-11-09T10:00:00Z');
const min = (n: number) => new Date(T0.getTime() + n * 60000);

function setup(over: { status?: string; quota?: number; used?: number; phone?: string } = {}) {
  const notifications: any[] = [];
  const business = {
    id: 'b1', name: 'Plomberie Martin', timezone: 'Europe/Paris', notificationPrefs: null,
    smsQuotaMonthly: over.quota ?? 50, smsUsedThisPeriod: over.used ?? 0,
  };
  const session = { lastNotifiedEtaAt: null as Date | null };
  const iv = {
    id: 'i1', businessId: 'b1', status: over.status ?? 'EN_ROUTE', delayMinutes: null, business,
    customer: { phone: over.phone ?? '06 12 34 56 78' },
    technician: { user: { firstName: 'Marc' } },
    trackingSessions: [session],
  };
  const prisma: any = {
    intervention: { findUnique: async () => iv },
    notification: {
      findUnique: async ({ where }: any) =>
        notifications.find((n) => n.idempotencyKey === where.idempotencyKey || n.id === where.id) ?? null,
      findMany: async ({ where }: any) =>
        notifications.filter((n) => n.interventionId === where.interventionId && n.status !== 'FAILED'),
      create: async ({ data }: any) => {
        const n = { id: `n${notifications.length + 1}`, status: 'QUEUED', attempts: 0, error: null, createdAt: new Date(), ...data };
        notifications.push(n);
        return n;
      },
      update: async ({ where, data }: any) => {
        const n = notifications.find((x) => x.id === where.id);
        for (const [k, v] of Object.entries<any>(data))
          n[k] = v && typeof v === 'object' && 'increment' in v ? n[k] + v.increment : v;
        return n;
      },
    },
    business: { update: async ({ data }: any) => { business.smsUsedThisPeriod += data.smsUsedThisPeriod.increment; } },
    trackingSession: { updateMany: async ({ data }: any) => { session.lastNotifiedEtaAt = data.lastNotifiedEtaAt; } },
  };
  const jobs: any[] = [];
  const queue: any = { add: async (name: string, data: any, opts: any) => jobs.push({ name, data, opts }) };
  const links: any = { issue: async () => 'https://track.test/t/tok123' };
  const provider = new ConsoleSmsProvider();
  const svc = new NotificationService(prisma, queue, links, provider);
  const drain = async () => { for (const j of jobs.splice(0)) await svc.deliver(j.data.notificationId, false); };
  return { svc, notifications, jobs, drain, business };
}

describe('NotificationService', () => {
  it('en_route produces exactly one EN_ROUTE SMS with a tracking link; repeats are deduped', async () => {
    const { svc, notifications, jobs, drain } = setup();
    const r1 = await svc.request({ interventionId: 'i1', kind: 'EN_ROUTE', version: 1, newEta: min(40) }, T0);
    const r2 = await svc.request({ interventionId: 'i1', kind: 'EN_ROUTE', version: 1, newEta: min(40) }, T0);
    expect(r1.status).toBe('queued');
    expect(r2.status).toBe('duplicate');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].opts).toMatchObject({ attempts: 3, backoff: { type: 'exponential' } });
    await drain();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ kind: 'EN_ROUTE', to: '+33612345678', status: 'SENT', provider: 'console', attempts: 1 });
    expect(notifications[0].body).toContain('https://track.test/t/tok123');
    expect(notifications[0].providerMessageId).toMatch(/^console-/);
  });

  it('ETA jitter of 1–5 minutes produces no extra SMS', async () => {
    const { svc, notifications } = setup();
    await svc.request({ interventionId: 'i1', kind: 'EN_ROUTE', version: 1, newEta: min(40) }, T0);
    for (const d of [1, 3, 5]) {
      const r = await svc.request({ interventionId: 'i1', kind: 'ETA_UPDATE', newEta: min(40 + d) }, min(30));
      expect(r).toEqual({ status: 'skipped', reason: 'eta_delta_below_threshold' });
    }
    expect(notifications).toHaveLength(1);
  });

  it('a real ETA change after the window sends one ETA_UPDATE', async () => {
    const { svc, notifications } = setup();
    await svc.request({ interventionId: 'i1', kind: 'EN_ROUTE', version: 1, newEta: min(40) }, T0);
    const r = await svc.request({ interventionId: 'i1', kind: 'ETA_UPDATE', newEta: min(60) }, min(25));
    expect(r.status).toBe('queued');
    expect(notifications).toHaveLength(2);
  });

  it('over quota records FAILED quota_exceeded and queues nothing', async () => {
    const { svc, notifications, jobs } = setup({ quota: 2, used: 2 });
    const r = await svc.request({ interventionId: 'i1', kind: 'EN_ROUTE', version: 1 }, T0);
    expect(r).toMatchObject({ status: 'failed', reason: 'quota_exceeded' });
    expect(notifications[0]).toMatchObject({ status: 'FAILED', error: 'quota_exceeded' });
    expect(jobs).toHaveLength(0);
  });

  it('terminal interventions get no SMS; invalid phones are recorded as failed', async () => {
    expect((await setup({ status: 'COMPLETED' }).svc.request({ interventionId: 'i1', kind: 'EN_ROUTE' }, T0)).status).toBe('skipped');
    const s = setup({ phone: '12' });
    expect(await s.svc.request({ interventionId: 'i1', kind: 'EN_ROUTE' }, T0)).toMatchObject({ status: 'failed', reason: 'invalid_phone' });
  });
});
