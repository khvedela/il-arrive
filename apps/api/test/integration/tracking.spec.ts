/* eslint-disable @typescript-eslint/no-explicit-any -- test helpers */
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import request from 'supertest';
import { PrismaService } from '../../src/common/prisma.service';
import { DatabaseModule } from '../../src/common/database.module';
import { RedisService } from '../../src/common/redis.service';
import { CreateSessionService } from '../../src/modules/auth/create-session.service';
import { InterventionModule } from '../../src/modules/intervention/intervention.module';
import { TrackingLinkService } from '../../src/modules/intervention/tracking-link.service';
import { TrackingModule } from '../../src/modules/tracking/tracking.module';
import { TrackingMaintenanceService } from '../../src/modules/tracking/tracking-maintenance.service';
import { TRACKING_QUEUE, allTrackingKeys, trackingKeys } from '../../src/modules/tracking/tracking.keys';
import { GeoModule } from '../../src/geo/geo.module';
import { GEOCODER_TOKEN } from '../../src/geo/geocoder.interface';

jest.setTimeout(60_000);

const geocoder = { calls: 0, search: async (q: string) => { geocoder.calls++; return [{ label: `${q} 75001 Paris`, lat: 48.86, lng: 2.34, score: 0.9 }]; }, autocomplete: async () => [] };

interface Sse { events: { event: string; data: any }[]; close(): void }

describe('SLA-9 live tracking (Postgres + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let maintenance: TrackingMaintenanceService;
  let port: number;
  let seq = 0;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        BullModule.forRoot({
          prefix: `sla9-test-${process.pid}`,
          connection: { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) },
        }),
        DatabaseModule,
        InterventionModule,
        TrackingModule,
        GeoModule.forRoot(),
      ],
    })
      .overrideProvider(GEOCODER_TOKEN)
      .useValue(geocoder)
      .compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    // The app has no middleware that populates `request.user` yet (AccessTokenGuard is fail-closed).
    // This stand-in resolves the opaque session + membership exactly like a real one would.
    app.use(async (req: any, _res: unknown, next: () => void) => {
      const token = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
      const verified = token ? await mod.get(CreateSessionService).verify(token) : null;
      if (verified) {
        const businessId = req.headers['x-business-id'] as string | undefined;
        const m = await mod.get(PrismaService).membership.findFirst({ where: { userId: verified.userId, ...(businessId ? { businessId } : {}) } });
        if (m) req.user = { userId: verified.userId, activeBusinessId: m.businessId, role: m.role, sessionId: verified.sessionId };
      }
      next();
    });
    await app.init();
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    maintenance = app.get(TrackingMaintenanceService);
  });

  afterAll(async () => {
    await app?.get<Queue>(getQueueToken(TRACKING_QUEUE)).obliterate({ force: true }).catch(() => undefined);
    await app?.close();
  });

  async function seed(role: 'TECHNICIAN' | 'OWNER' = 'TECHNICIAN') {
    const n = `${Date.now()}-${++seq}`;
    const business = await prisma.business.create({ data: { name: 'Plomberie Martin', slug: `trk-${n}`, phone: '+33100000000' } });
    const user = await prisma.user.create({ data: { email: `trk-${n}@x.test`, passwordHash: 'x', firstName: 'Marc', lastName: 'D' } });
    const tech = await prisma.membership.create({ data: { userId: user.id, businessId: business.id, role, isTechnician: true } });
    const customer = await prisma.customer.create({ data: { businessId: business.id, name: 'Client', phone: '06 12 34 56 78' } });
    const end = new Date(Date.now() + 2 * 3600_000);
    const iv = await prisma.intervention.create({
      data: {
        businessId: business.id, customerId: customer.id, technicianMembershipId: tech.id, addressLabel: '1 rue X',
        addressLat: 48.8606, addressLng: 2.3376, // Louvre
        scheduledDate: end, windowStart: new Date(end.getTime() - 3600_000), windowEnd: end, status: 'SCHEDULED',
      },
    });
    const bearer = `Bearer ${(await app.get(CreateSessionService).execute({ userId: user.id })).token}`;
    const link = await app.get(TrackingLinkService).issue(iv.id, end);
    const token: string = (link as any).token ?? (link as any).url?.split('/t/')[1];
    return { business, user, tech, iv, bearer, token };
  }
  type Ctx = Awaited<ReturnType<typeof seed>>;

  const http$ = () => request(app.getHttpServer());
  const tech = (c: Ctx, method: 'patch' | 'post', path: string) =>
    http$()[method](`/tech/interventions/${c.iv.id}/${path}`).set('authorization', c.bearer).set('x-business-id', c.business.id);
  const fix = (over: Record<string, unknown> = {}) => ({ lat: 48.8, lng: 2.3, accuracy: 15, timestamp: new Date().toISOString(), ...over });
  const postFix = (c: Ctx, body: Record<string, unknown> = fix(), clearRate = true) => ({
    expect: async (status: number) => {
      if (clearRate) await redis.del(trackingKeys.rateLimit(c.iv.id));
      const res = await tech(c, 'post', 'location').send(body);
      expect({ status: res.status, body: res.body }).toMatchObject({ status });
      return res;
    },
  });
  const session = (c: Ctx) => prisma.trackingSession.findUniqueOrThrow({ where: { interventionId: c.iv.id } });
  const keysLeft = async (c: Ctx) => (await redis.exists(...allTrackingKeys(c.iv.id)));
  const until = async <T>(fn: () => Promise<T | false | undefined | null>, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() - t0 > ms) throw new Error('timeout waiting for condition');
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  function openSse(token: string): Promise<Sse> {
    return new Promise((resolve, reject) => {
      const events: Sse['events'] = [];
      const req = http.get({ port, path: `/public/track/${token}/events`, headers: { accept: 'text/event-stream' } }, (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          buf += chunk;
          let i: number;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const event = /^event: (.+)$/m.exec(block)?.[1];
            const data = /^data: (.+)$/m.exec(block)?.[1];
            if (event && data) events.push({ event, data: JSON.parse(data) });
          }
        });
        resolve({ events, close: () => req.destroy() });
      });
      req.on('error', (e) => (e as any).code === 'ECONNRESET' ? undefined : reject(e));
    });
  }

  it('start → fixes → ETA over SSE → stale → arrived: position nulled, Redis keys gone, 409 afterwards', async () => {
    const c = await seed();
    await tech(c, 'patch', 'en-route').expect(204);
    const started = await session(c);
    expect(started.endedAt).toBeNull();

    const sse = await openSse(c.token);
    try {
      await until(async () => sse.events.length > 0);
      expect(sse.events[0].data.locationStatus).toBe('UNAVAILABLE');

      // first fix: stored (PG + Redis), ETA computed on the first fix, pushed over SSE
      await postFix(c).expect(202);
      const s1 = await session(c);
      expect(s1.lastLat).toBe(48.8);
      expect(s1.etaSource).toBe('fake');
      expect(s1.etaAt).not.toBeNull();
      expect(s1.etaComputedAt).not.toBeNull();
      expect(JSON.parse((await redis.get(trackingKeys.fix(c.iv.id)))!)).toMatchObject({ lat: 48.8, lng: 2.3 });
      const live = await until(async () => sse.events.map((e) => e.data).find((p) => p.eta && p.locationStatus === 'LIVE' && p.location?.lat));
      expect(live.etaComputedAt).toBe(s1.etaComputedAt!.toISOString());
      const etaEvents = await prisma.interventionEvent.findMany({ where: { interventionId: c.iv.id, type: 'intervention.eta.updated' } });
      expect(etaEvents).toHaveLength(1);

      // same-minute fix far away: stored, but the 1 call/min cap holds the ETA
      await postFix(c, fix({ lat: 48.9, lng: 2.4 })).expect(202);
      expect((await session(c)).etaComputedAt!.getTime()).toBe(s1.etaComputedAt!.getTime());

      // rate limit: 1 fix / 5 s / session
      await postFix(c, fix(), false).expect(429); // the far fix above took the 5 s slot

      // stale: fix older than 120 s -> the job pushes once; coordinates hidden, last ETA + timestamp kept
      await prisma.trackingSession.update({ where: { interventionId: c.iv.id }, data: { lastFixAt: new Date(Date.now() - 180_000) } });
      const before = sse.events.length;
      expect((await maintenance.sweep()).staleNotified).toContain(c.iv.id);
      const stale = await until(async () => sse.events.slice(before).map((e) => e.data).find((p) => p.locationStatus === 'STALE'));
      expect(stale.location.lat).toBeUndefined();
      expect(stale.eta).toBe(s1.etaAt!.toISOString());
      expect(stale.etaComputedAt).toBe(s1.etaComputedAt!.toISOString());
      expect((await maintenance.sweep()).staleNotified).not.toContain(c.iv.id);

      // arrived ends the session
      await tech(c, 'patch', 'arrived').expect(204);
      const ended = await session(c);
      expect(ended.endedAt).not.toBeNull();
      expect([ended.lastLat, ended.lastLng, ended.lastAccuracy, ended.lastFixAt]).toEqual([null, null, null, null]);
      expect(await keysLeft(c)).toBe(0);
      await until(async () => sse.events.map((e) => e.data).find((p) => p.status === 'ARRIVED' && !p.location && p.locationStatus === 'UNAVAILABLE'));
      await postFix(c).expect(409);
    } finally {
      sse.close();
    }
  });

  it('rejects bad fixes, strangers and non-EN_ROUTE interventions', async () => {
    const c = await seed();
    await postFix(c).expect(409); // SCHEDULED: nothing to track yet
    await tech(c, 'patch', 'en-route').expect(204);

    await postFix(c, fix({ accuracy: 500 })).expect(400);
    await postFix(c, fix({ timestamp: new Date(Date.now() + 120_000).toISOString() })).expect(400);
    await postFix(c, fix({ timestamp: new Date(Date.now() - 3600_000).toISOString() })).expect(400);
    await postFix(c, fix({ lat: 'x' })).expect(400);
    expect((await session(c)).lastFixAt).toBeNull();

    const other = await seed();
    await http$().post(`/tech/interventions/${c.iv.id}/location`).set('authorization', other.bearer)
      .set('x-business-id', other.business.id).send(fix()).expect((r) => expect([403, 404]).toContain(r.status));
    await http$().post(`/tech/interventions/${c.iv.id}/location`).send(fix()).expect(401);
  });

  it('keeps only the last fix and ignores an out-of-order older one', async () => {
    const c = await seed();
    await tech(c, 'patch', 'en-route').expect(204);
    const t1 = new Date(Date.now() - 20_000);
    const t2 = new Date(Date.now() - 10_000);
    await postFix(c, fix({ lat: 48.81, timestamp: t2.toISOString() })).expect(202);
    const r = await postFix(c, fix({ lat: 48.5, timestamp: t1.toISOString() })).expect(202);
    expect(r.body.accepted).toBe(false);
    expect((await session(c)).lastLat).toBe(48.81);
    expect(await prisma.trackingSession.count({ where: { interventionId: c.iv.id } })).toBe(1); // no history table/rows
  });

  it('stop_route ends the session; a new en_route starts a fresh one', async () => {
    const c = await seed();
    await tech(c, 'patch', 'en-route').expect(204);
    await postFix(c).expect(202);
    await tech(c, 'patch', 'stop').expect(204);
    const ended = await session(c);
    expect(ended.endedAt).not.toBeNull();
    expect(ended.lastLat).toBeNull();
    expect(await keysLeft(c)).toBe(0);
    await postFix(c).expect(409);

    await tech(c, 'patch', 'en-route').expect(204);
    const again = await session(c);
    expect(again.endedAt).toBeNull();
    expect(again.etaAt).toBeNull();
    await postFix(c).expect(202);
  });

  it('auto-expires after 3 h (sweep): session ended, position nulled, keys gone, 409', async () => {
    const c = await seed();
    await tech(c, 'patch', 'en-route').expect(204);
    await postFix(c).expect(202);
    expect(await keysLeft(c)).toBeGreaterThan(0);

    await prisma.trackingSession.update({ where: { interventionId: c.iv.id }, data: { startedAt: new Date(Date.now() - (3 * 3600 + 60) * 1000) } });
    expect((await maintenance.sweep()).expired).toContain(c.iv.id);
    const s = await session(c);
    expect(s.endedAt).not.toBeNull();
    expect([s.lastLat, s.lastLng, s.lastAccuracy, s.lastFixAt]).toEqual([null, null, null, null]);
    expect(await keysLeft(c)).toBe(0);
    await postFix(c).expect(409);
  });

  it('registers the repeatable sweep job in BullMQ', async () => {
    const schedulers = await app.get<Queue>(getQueueToken(TRACKING_QUEUE)).getJobSchedulers();
    expect(schedulers.map((s) => s.key)).toContain('tracking-sweep');
  });

  describe('GET /geo/search', () => {
    it('is role-guarded, cached in Redis and rate limited', async () => {
      const c = await seed('OWNER');
      const q = `rue de rivoli ${Date.now()}`;
      const search = (qs = q) => http$().get('/geo/search').query({ q: qs }).set('authorization', c.bearer).set('x-business-id', c.business.id);

      await http$().get('/geo/search').query({ q }).expect(401);
      await search('').expect(400);
      const before = geocoder.calls;
      const first = await search().expect(200);
      const second = await search().expect(200);
      expect(second.body).toEqual(first.body);
      expect(geocoder.calls - before).toBe(1);

      const limited: number[] = [];
      for (let i = 0; i < 35; i++) limited.push((await search()).status);
      expect(limited).toContain(429);
    });
  });
});
