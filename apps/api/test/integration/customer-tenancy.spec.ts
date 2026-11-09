/* eslint-disable @typescript-eslint/no-explicit-any -- test helpers */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import request from 'supertest';
import { PrismaService } from '../../src/common/prisma.service';
import { DatabaseModule } from '../../src/common/database.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { CreateSessionService } from '../../src/modules/auth/create-session.service';
import { CustomerModule } from '../../src/modules/customer/customer.module';
import { InterventionModule } from '../../src/modules/intervention/intervention.module';
import { MembersModule } from '../../src/modules/members/members.module';
import { TrackingModule } from '../../src/modules/tracking/tracking.module';
import { TRACKING_QUEUE } from '../../src/modules/tracking/tracking.keys';
import { GeoModule } from '../../src/geo/geo.module';

jest.setTimeout(60_000);

describe('SLA-48 customers API: tenant/role boundary and phone dedup (real HTTP + Postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seq = 0;
  const run = `${Date.now()}`;
  const n = () => `${run}-${++seq}`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        BullModule.forRoot({
          prefix: `sla48-test-${process.pid}`,
          connection: { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) },
        }),
        DatabaseModule,
        AuthModule,
        CustomerModule,
        MembersModule,
        InterventionModule,
        TrackingModule,
        GeoModule.forRoot(),
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app?.get<Queue>(getQueueToken(TRACKING_QUEUE)).obliterate({ force: true }).catch(() => undefined);
    await app?.close();
  });

  async function actor(businessId: string, role: 'OWNER' | 'DISPATCHER' | 'TECHNICIAN', label: string) {
    const user = await prisma.user.create({ data: { email: `${label}-${n()}@x.test`, passwordHash: 'x', firstName: label, lastName: 'T' } });
    const membership = await prisma.membership.create({ data: { userId: user.id, businessId, role, isTechnician: role === 'TECHNICIAN' } });
    const token = (await app.get(CreateSessionService).execute({ userId: user.id })).token;
    return { user, membership, token, businessId };
  }
  type Actor = Awaited<ReturnType<typeof actor>>;

  async function seed() {
    const s = n();
    const a = await prisma.business.create({ data: { name: 'A', slug: `ca-${s}`, phone: '+33100000000' } });
    const b = await prisma.business.create({ data: { name: 'B', slug: `cb-${s}`, phone: '+33100000000' } });
    return {
      a, b,
      ownerA: await actor(a.id, 'OWNER', 'ownerA'),
      dispA: await actor(a.id, 'DISPATCHER', 'dispA'),
      techA: await actor(a.id, 'TECHNICIAN', 'techA'),
      ownerB: await actor(b.id, 'OWNER', 'ownerB'),
    };
  }

  const as = (m: 'get' | 'post', path: string, who: Actor, businessHeader: string | null = who.businessId) => {
    const r = request(app.getHttpServer())[m](path).set('Authorization', `Bearer ${who.token}`);
    return businessHeader ? r.set('x-business-id', businessHeader) : r;
  };
  let ph = 0;
  const uniquePhone = () => `+3361${String(Number(run.slice(-6)) * 10 + ++ph).padStart(8, '0')}`;

  describe('authentication and roles', () => {
    it('401 unauthenticated; 403 TECHNICIAN on GET and POST; OWNER/DISPATCHER succeed', async () => {
      const t = await seed();
      await request(app.getHttpServer()).get('/customers').expect(401);
      await request(app.getHttpServer()).post('/customers').send({ name: 'X', phone: uniquePhone() }).expect(401);
      await as('get', '/customers', t.techA).expect(403);
      await as('post', '/customers', t.techA).send({ name: 'X', phone: uniquePhone() }).expect(403);
      await as('post', '/customers', t.ownerA).send({ name: 'Own', phone: uniquePhone() }).expect(201);
      await as('post', '/customers', t.dispA).send({ name: 'Disp', phone: uniquePhone() }).expect(201);
      const list = await as('get', '/customers', t.dispA).expect(200);
      expect(list.body.map((c: any) => c.name).sort()).toEqual(['Disp', 'Own']);
    });

    it('foreign x-business-id is denied (401) on list and create, and persists nothing', async () => {
      const t = await seed();
      await as('get', '/customers', t.ownerA, t.b.id).expect(401);
      await as('post', '/customers', t.ownerA, t.b.id).send({ name: 'Leak', phone: uniquePhone() }).expect(401);
      expect(await prisma.customer.count({ where: { businessId: { in: [t.a.id, t.b.id] } } })).toBe(0);
    });
  });

  describe('tenant scoping', () => {
    it('body/query businessId cannot redirect create or list; rows persist only in the active business', async () => {
      const t = await seed();
      const p = uniquePhone();
      const created = await as('post', '/customers', t.ownerA).send({ name: 'Mine', phone: p, businessId: t.b.id }).expect(201);
      const row = await prisma.customer.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(row.businessId).toBe(t.a.id);
      expect(await prisma.customer.count({ where: { businessId: t.b.id } })).toBe(0);

      await as('post', '/customers', t.ownerB).send({ name: 'Theirs', phone: uniquePhone() }).expect(201);
      const list = await as('get', `/customers?businessId=${t.b.id}`, t.ownerA).expect(200);
      expect(list.body.map((c: any) => c.name)).toEqual(['Mine']);
      const search = await as('get', '/customers?q=Theirs', t.ownerA).expect(200);
      expect(search.body).toEqual([]);
    });

    it('intervention list/today customer+technician projections and members membershipId stay tenant scoped', async () => {
      const t = await seed();
      const cA = await prisma.customer.create({ data: { businessId: t.a.id, name: 'CustA', phone: uniquePhone() } });
      const cB = await prisma.customer.create({ data: { businessId: t.b.id, name: 'CustB', phone: uniquePhone() } });
      const techB = await actor(t.b.id, 'TECHNICIAN', 'techB');
      const when = new Date();
      const mk = (businessId: string, customerId: string, tech: string) =>
        prisma.intervention.create({
          data: {
            businessId, customerId, technicianMembershipId: tech, addressLabel: '1 rue X', addressLat: 48.8, addressLng: 2.3,
            scheduledDate: when, windowStart: when, windowEnd: new Date(when.getTime() + 3600_000), status: 'SCHEDULED',
          },
        });
      const ivA = await mk(t.a.id, cA.id, t.techA.membership.id);
      await mk(t.b.id, cB.id, techB.membership.id);

      const list = await as('get', '/interventions', t.ownerA).expect(200);
      expect(list.body.map((i: any) => i.id)).toEqual([ivA.id]);
      expect(list.body[0].customer).toMatchObject({ id: cA.id, name: 'CustA' });
      expect(list.body[0].technician.id).toBe(t.techA.membership.id);
      expect(JSON.stringify(list.body)).not.toContain('CustB');

      const today = await as('get', '/interventions/today', t.ownerA).expect(200);
      const flat = JSON.stringify(today.body);
      expect(flat).toContain(ivA.id);
      expect(flat).toContain('CustA');
      expect(flat).not.toContain('CustB');
      expect(flat).not.toContain(techB.membership.id);

      const members = await as('get', '/members', t.ownerA).expect(200);
      const ids = members.body.map((m: any) => m.membershipId).sort();
      expect(ids).toEqual([t.ownerA.membership.id, t.dispA.membership.id, t.techA.membership.id].sort());
      await as('get', '/members', t.techA).expect(403);
    });
  });

  describe('phone find-or-create', () => {
    it('same phone in the same business returns the existing customer unchanged (200); no silent overwrite', async () => {
      const t = await seed();
      const p = uniquePhone();
      const first = await as('post', '/customers', t.ownerA).send({ name: 'Original', phone: p, email: 'o@x.test' }).expect(201);
      const again = await as('post', '/customers', t.dispA).send({ name: 'Other Name', phone: p, email: 'new@x.test' }).expect(200);
      expect(again.body).toEqual(first.body);
      expect(await prisma.customer.count({ where: { businessId: t.a.id, phone: p } })).toBe(1);
      const row = await prisma.customer.findUniqueOrThrow({ where: { id: first.body.id } });
      expect(row).toMatchObject({ name: 'Original', email: 'o@x.test' });
    });

    it('identical phone in two businesses stays independent', async () => {
      const t = await seed();
      const p = uniquePhone();
      const a = await as('post', '/customers', t.ownerA).send({ name: 'Same', phone: p }).expect(201);
      const b = await as('post', '/customers', t.ownerB).send({ name: 'Same', phone: p }).expect(201);
      expect(a.body.id).not.toBe(b.body.id);
      expect((await prisma.customer.findUniqueOrThrow({ where: { id: b.body.id } })).businessId).toBe(t.b.id);
    });

    it('concurrent same-tenant creates yield exactly one row and one 201', async () => {
      const t = await seed();
      const p = uniquePhone();
      const res = await Promise.all(
        Array.from({ length: 10 }, (_, i) => as('post', '/customers', t.ownerA).send({ name: `Race ${i}`, phone: p })),
      );
      expect(res.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 200, 200, 200, 200, 200, 201]);
      expect(new Set(res.map((r) => r.body.id)).size).toBe(1);
      expect(await prisma.customer.count({ where: { businessId: t.a.id, phone: p } })).toBe(1);
    });

    it('pre-existing duplicate rows do not break creates: the oldest is returned deterministically', async () => {
      const t = await seed();
      const p = uniquePhone();
      const old = await prisma.customer.create({ data: { businessId: t.a.id, name: 'Old', phone: p, createdAt: new Date(Date.now() - 10_000) } });
      await prisma.customer.create({ data: { businessId: t.a.id, name: 'Newer dup', phone: p } });
      const res = await as('post', '/customers', t.ownerA).send({ name: 'Third', phone: p }).expect(200);
      expect(res.body.id).toBe(old.id);
      expect(await prisma.customer.count({ where: { businessId: t.a.id, phone: p } })).toBe(2);
    });
  });

  describe('validation', () => {
    it('trims name before validation: whitespace-only is 400, padded names are stored trimmed', async () => {
      const t = await seed();
      await as('post', '/customers', t.ownerA).send({ name: '   ', phone: uniquePhone() }).expect(400);
      await as('post', '/customers', t.ownerA).send({ name: '\t\n', phone: uniquePhone() }).expect(400);
      await as('post', '/customers', t.ownerA).send({ name: 123, phone: uniquePhone() }).expect(400);
      const ok = await as('post', '/customers', t.ownerA).send({ name: '  Jean  ', phone: uniquePhone() }).expect(201);
      expect(ok.body.name).toBe('Jean');
      await as('post', '/customers', t.ownerA).send({ name: 'Bad', phone: '0612345678' }).expect(400);
      expect(await prisma.customer.count({ where: { businessId: t.a.id } })).toBe(1);
    });

    it('q: non-string or repeated q is 400 (not 500); blank q lists all; valid q filters', async () => {
      const t = await seed();
      await as('post', '/customers', t.ownerA).send({ name: 'Zoe Martin', phone: uniquePhone() }).expect(201);
      await as('get', '/customers?q=a&q=b', t.ownerA).expect(400);
      expect((await as('get', '/customers?q=%20%20', t.ownerA).expect(200)).body).toHaveLength(1);
      expect((await as('get', '/customers?q=zoe', t.ownerA).expect(200)).body).toHaveLength(1);
      expect((await as('get', '/customers?q=nobody', t.ownerA).expect(200)).body).toEqual([]);
    });
  });
});
