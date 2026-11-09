/* eslint-disable @typescript-eslint/no-explicit-any -- test helpers */
process.env.NOTIFICATION_BACKOFF_MS = '50';

import { createHash } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import request from 'supertest';
import { PrismaService } from '../../src/common/prisma.service';
import { NotificationModule, NotificationWorkerModule } from '../../src/modules/notification/notification.module';
import { NotificationService, NOTIFICATIONS_QUEUE } from '../../src/modules/notification/notification.service';
import { NotificationEventsService } from '../../src/modules/notification/notification-events.service';
import { SMS_PROVIDER } from '../../src/modules/notification/sms-provider';

jest.setTimeout(60_000);

const provider = {
  name: 'console',
  failing: false,
  keys: [] as string[],
  async send(_to: string, _body: string, key: string) {
    this.keys.push(key);
    if (this.failing) throw new Error('provider down');
    return { providerMessageId: `test-${key}` };
  },
};

describe('Notifications (Postgres + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let svc: NotificationService;
  let events: NotificationEventsService;
  let queue: Queue;
  let seq = 0;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        BullModule.forRoot({
          connection: { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) },
        }),
        NotificationWorkerModule, // consumes the queue
        NotificationModule, // controllers
      ],
    })
      .overrideProvider(SMS_PROVIDER)
      .useValue(provider)
      .compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    // Stand-in for the auth module: attaches request.auth from a header.
    app.use((req: any, _res: any, next: any) => {
      const h = req.headers['x-test-auth'];
      if (h) req.auth = JSON.parse(String(h));
      next();
    });
    await app.init();
    prisma = mod.get(PrismaService, { strict: false });
    svc = mod.get(NotificationService, { strict: false });
    events = mod.get(NotificationEventsService, { strict: false });
    queue = mod.get(getQueueToken(NOTIFICATIONS_QUEUE), { strict: false });
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    provider.failing = false;
    provider.keys = [];
  });

  async function seed(o: { quota?: number; status?: any; windowEndOffsetH?: number; periodStart?: Date } = {}) {
    const n = `${Date.now()}-${++seq}`;
    const business = await prisma.business.create({
      data: {
        name: 'Plomberie Martin', slug: `biz-${n}`, phone: '+33100000000',
        smsQuotaMonthly: o.quota ?? 50,
        ...(o.periodStart ? { smsPeriodStart: o.periodStart } : {}),
      },
    });
    const user = await prisma.user.create({
      data: { email: `tech-${n}@x.test`, passwordHash: 'x', firstName: 'Marc', lastName: 'D' },
    });
    const tech = await prisma.membership.create({
      data: { userId: user.id, businessId: business.id, role: 'TECHNICIAN', isTechnician: true },
    });
    const customer = await prisma.customer.create({
      data: { businessId: business.id, name: 'Client', phone: '06 12 34 56 78' },
    });
    const end = new Date(Date.now() + (o.windowEndOffsetH ?? 2) * 3600_000);
    const iv = await prisma.intervention.create({
      data: {
        businessId: business.id, customerId: customer.id, technicianMembershipId: tech.id,
        addressLabel: '1 rue X', scheduledDate: end, windowStart: new Date(end.getTime() - 3600_000), windowEnd: end,
        status: o.status ?? 'EN_ROUTE',
      },
    });
    await prisma.trackingSession.create({ data: { interventionId: iv.id, startedAt: new Date() } });
    return { business, user, tech, iv };
  }

  async function until<T>(fn: () => Promise<T | null | undefined | false>, ms = 15_000): Promise<T> {
    const t0 = Date.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() - t0 > ms) throw new Error('timeout waiting for condition');
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const min = (m: number) => new Date(Date.now() + m * 60_000);
  const rows = (interventionId: string) => prisma.notification.findMany({ where: { interventionId } });

  it('en_route → exactly one SMS via worker, with a resolvable tracking link; ETA jitter sends nothing', async () => {
    const { iv, business } = await seed();
    const eta = min(40);
    await events.handle({ type: 'intervention.en_route', interventionId: iv.id, eta });
    const sent = await until(async () => (await rows(iv.id)).find((n) => n.status === 'SENT'));
    expect(sent).toMatchObject({ kind: 'EN_ROUTE', to: '+33612345678', provider: 'console', attempts: 1 });

    const token = sent.body.match(/\/t\/([\w-]+)/)![1];
    expect(token.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url
    const link = await prisma.trackingLink.findUnique({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    });
    expect(link?.interventionId).toBe(iv.id);
    expect(link!.expiresAt.getTime()).toBe(iv.windowEnd.getTime() + 48 * 3600_000);

    for (const d of [1, 3, 5]) {
      const r = await events.handle({
        type: 'intervention.eta.updated', interventionId: iv.id, eta: new Date(eta.getTime() + d * 60_000),
      });
      expect(r).toEqual({ status: 'skipped', reason: 'eta_delta_below_threshold' });
    }
    expect(await rows(iv.id)).toHaveLength(1);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).smsUsedThisPeriod).toBe(1);
    expect((await prisma.trackingSession.findFirstOrThrow({ where: { interventionId: iv.id } })).lastNotifiedEtaAt)
      .toEqual(eta);

    // redelivery of the same event is deduped
    await events.handle({ type: 'intervention.en_route', interventionId: iv.id, eta });
    expect(await rows(iv.id)).toHaveLength(1);
  });

  it('concurrent requests cannot overrun the quota or the 5-SMS cap', async () => {
    const q = await seed({ quota: 3 });
    const res = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        svc.request({ interventionId: q.iv.id, kind: 'CONFIRMATION', version: i, manual: true }),
      ),
    );
    expect(res.filter((r) => r.status === 'queued')).toHaveLength(3);
    expect(res.filter((r) => r.status === 'failed')).toHaveLength(5);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: q.business.id } })).smsUsedThisPeriod).toBe(3);

    const c = await seed({ quota: 50 });
    const res2 = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        svc.request({ interventionId: c.iv.id, kind: 'CONFIRMATION', version: i, manual: true }),
      ),
    );
    expect(res2.filter((r) => r.status === 'queued')).toHaveLength(5);
    expect(res2.filter((r) => r.status === 'skipped')).toHaveLength(3);
    // let the worker drain before later tests flip the provider to failing
    await until(async () => (await prisma.notification.count({ where: { status: 'QUEUED' } })) === 0);
  });

  it('retry exhaustion → FAILED after 3 attempts and quota refunded', async () => {
    provider.failing = true;
    const { iv, business } = await seed();
    await svc.request({ interventionId: iv.id, kind: 'EN_ROUTE', version: 1 });
    const failed = await until(async () => (await rows(iv.id)).find((n) => n.status === 'FAILED'));
    expect(failed).toMatchObject({ attempts: 3, error: 'provider down' });
    expect(provider.keys.filter((k) => k.startsWith(iv.id))).toHaveLength(3);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).smsUsedThisPeriod).toBe(0);
  });

  it('recovers a reserved row whose enqueue failed (reconciler)', async () => {
    const { iv } = await seed();
    jest.spyOn(queue, 'add').mockRejectedValueOnce(new Error('redis down'));
    const r = await svc.request({ interventionId: iv.id, kind: 'EN_ROUTE', version: 1 });
    expect(r.status).toBe('queued');
    expect((await rows(iv.id))[0].status).toBe('QUEUED');
    await svc.requeueStale(0);
    await until(async () => (await rows(iv.id)).find((n) => n.status === 'SENT'));
  });

  describe('dispatch-time guards (rows inserted directly so no worker race)', () => {
    async function queued(ivId: string, data: Record<string, any>) {
      const iv = await prisma.intervention.findUniqueOrThrow({ where: { id: ivId }, include: { business: true } });
      return prisma.notification.create({
        data: {
          interventionId: ivId, channel: 'SMS', to: '+33612345678', body: 'x', provider: 'console',
          idempotencyKey: `${ivId}:${Math.random()}`, quotaPeriodStart: iv.business.smsPeriodStart, ...data,
        } as any,
      });
    }

    it('terminal intervention at send time → FAILED intervention_terminal + refund', async () => {
      const { iv, business } = await seed({ status: 'COMPLETED' });
      await prisma.business.update({ where: { id: business.id }, data: { smsUsedThisPeriod: 1 } });
      const n = await queued(iv.id, { kind: 'EN_ROUTE' });
      await svc.deliver(n.id, false);
      expect(await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).toMatchObject({
        status: 'FAILED', error: 'terminal_intervention',
      });
      expect((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).smsUsedThisPeriod).toBe(0);
      expect(provider.keys.filter((k) => k.startsWith(iv.id))).toHaveLength(0);
    });

    it('ETA_UPDATE closer than 20 min to the last actual send is suppressed at dispatch', async () => {
      const { iv } = await seed();
      await queued(iv.id, { kind: 'EN_ROUTE', status: 'SENT', sentAt: new Date(Date.now() - 5 * 60_000) });
      const n = await queued(iv.id, { kind: 'ETA_UPDATE', etaAt: min(90) });
      await svc.deliver(n.id, false);
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).error).toBe('eta_too_soon');
      expect(provider.keys.filter((k) => k.startsWith(iv.id))).toHaveLength(0);
    });

    it('a refund after month rollover does not decrement the new month', async () => {
      const { iv, business } = await seed({ status: 'COMPLETED' });
      await prisma.business.update({ where: { id: business.id }, data: { smsUsedThisPeriod: 2 } });
      const n = await queued(iv.id, { kind: 'EN_ROUTE', quotaPeriodStart: new Date('2020-01-01T00:00:00Z') });
      await svc.deliver(n.id, false);
      expect((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).smsUsedThisPeriod).toBe(2);
    });

    it('a second deliver of the same notification is a no-op (idempotent)', async () => {
      const { iv, business } = await seed({ status: 'COMPLETED' });
      await prisma.business.update({ where: { id: business.id }, data: { smsUsedThisPeriod: 2 } });
      const n = await queued(iv.id, { kind: 'EN_ROUTE' });
      await svc.deliver(n.id, false);
      await svc.deliver(n.id, false);
      expect((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).smsUsedThisPeriod).toBe(1);
    });
  });

  it('refuses to mint a tracking link for an intervention whose window expired > 48h ago', async () => {
    const { iv } = await seed({ windowEndOffsetH: -72 });
    const r = await svc.request({ interventionId: iv.id, kind: 'EN_ROUTE', version: 1 });
    expect(r).toMatchObject({ status: 'failed', reason: 'tracking_link_expired' });
  });

  it('applyDeliveryStatus updates DELIVERED / FAILED', async () => {
    const { iv } = await seed();
    await svc.request({ interventionId: iv.id, kind: 'EN_ROUTE', version: 1 });
    const sent = await until(async () => (await rows(iv.id)).find((n) => n.status === 'SENT'));
    await svc.applyDeliveryStatus(sent.providerMessageId!, 'DELIVERED');
    expect((await rows(iv.id))[0].status).toBe('DELIVERED');
    await svc.applyDeliveryStatus(sent.providerMessageId!, 'FAILED', 'handset off');
    expect((await rows(iv.id))[0]).toMatchObject({ status: 'FAILED', error: 'handset off' });
  });

  describe('HTTP auth isolation', () => {
    const auth = (a: object) => JSON.stringify(a);

    it('rejects unauthenticated and wrong-role callers; scopes by business', async () => {
      const a = await seed();
      const b = await seed();
      const http = () => request(app.getHttpServer());

      await http().post(`/interventions/${a.iv.id}/notify`).send({ kind: 'EN_ROUTE' }).expect(401);
      await http().get('/business/sms-usage').expect(401);

      const techOfA = { userId: a.user.id, businessId: a.business.id, role: 'TECHNICIAN' };
      await http().post(`/interventions/${a.iv.id}/notify`).set('x-test-auth', auth(techOfA))
        .send({ kind: 'EN_ROUTE' }).expect(403);

      const ownerOfB = { userId: 'u', businessId: b.business.id, role: 'OWNER' };
      await http().post(`/interventions/${a.iv.id}/notify`).set('x-test-auth', auth(ownerOfB))
        .send({ kind: 'EN_ROUTE' }).expect(404);
      await http().get(`/interventions/${a.iv.id}/share-message`).set('x-test-auth', auth(ownerOfB)).expect(404);
      expect(await rows(a.iv.id)).toHaveLength(0);

      // technician of A: own intervention OK, someone else's not
      const share = await http().get(`/interventions/${a.iv.id}/share-message`)
        .set('x-test-auth', auth(techOfA)).expect(200);
      expect(share.body.smsUri).toMatch(/^sms:\+33612345678\?body=/);
      expect(share.body.link).toContain('/t/');
      const a2 = await seed();
      await http().get(`/interventions/${a2.iv.id}/share-message`).set('x-test-auth', auth(techOfA)).expect(404);

      const ownerOfA = { userId: 'u', businessId: a.business.id, role: 'OWNER' };
      await http().post(`/interventions/${a.iv.id}/notify`).set('x-test-auth', auth(ownerOfA))
        .send({ kind: 'CONFIRMATION' }).expect(202);
      const usage = await http().get('/business/sms-usage').set('x-test-auth', auth(ownerOfA)).expect(200);
      expect(usage.body).toMatchObject({ quota: 50, used: 1, remaining: 49 });
    });
  });
});
