/* eslint-disable @typescript-eslint/no-explicit-any -- test helpers */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../src/common/prisma.service';
import { DatabaseModule } from '../../src/common/database.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { CreateSessionService } from '../../src/modules/auth/create-session.service';

jest.setTimeout(60_000);

function cookieJar(res: request.Response): { cookie: string; csrf: string } {
  const set = (res.headers['set-cookie'] as unknown as string[]) ?? [];
  const pairs = set.map((c) => c.split(';')[0]);
  const csrf = decodeURIComponent(pairs.find((p) => p.startsWith('csrf_token='))?.split('=')[1] ?? '');
  return { cookie: pairs.join('; '), csrf };
}

describe('SLA-39 session auth over real HTTP (Postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: CreateSessionService;
  let seq = 0;
  const n = () => `${Date.now()}-${++seq}`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), DatabaseModule, AuthModule],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    sessions = app.get(CreateSessionService);
  });
  afterAll(async () => app?.close());

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'Sup3rSecret!pw', firstName: 'Ana', lastName: 'B', businessName: 'Biz', phone: '+33100000000' });

  it('register issues session+CSRF cookies; cookie /me returns the shared MeResponse; CSRF gates mutations', async () => {
    const res = await register(`reg-${n()}@x.test`).expect(201);
    const { cookie, csrf } = cookieJar(res);
    expect(cookie).toContain('session=');
    expect(csrf).not.toBe('');

    const me = await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.activeBusinessId).toBe(res.body.activeBusinessId);
    expect(me.body.activeMembership).toMatchObject({ businessId: res.body.activeBusinessId, role: 'OWNER', onboardingCompleted: false });
    expect(me.body.memberships[0]).toMatchObject({ id: res.body.activeBusinessId, businessId: res.body.activeBusinessId });
    expect(res.body.activeMembership).toEqual(me.body.activeMembership);

    const patch = (h: Record<string, string>) =>
      request(app.getHttpServer()).patch('/auth/password').set('Cookie', cookie).set(h).send({ currentPassword: 'wrong-password-1', newPassword: 'An0therSecret!pw' });
    await patch({}).expect(403);
    await patch({ 'x-csrf-token': 'nope' }).expect(403);
    // passes CSRF + auth; wrong current password is rejected by the handler (401), not by CSRF/guard (403)
    const ok = await patch({ 'x-csrf-token': csrf });
    expect(ok.body.message).toBe('Current password is incorrect');
  });

  describe('multi-business principal consistency', () => {
    async function seed() {
      const s = n();
      const user = await prisma.user.create({ data: { email: `mb-${s}@x.test`, passwordHash: 'x', firstName: 'M', lastName: 'B' } });
      const older = await prisma.business.create({ data: { name: 'Older', slug: `old-${s}`, phone: '+33100000000' } });
      const newer = await prisma.business.create({ data: { name: 'Newer', slug: `new-${s}`, phone: '+33100000000' } });
      const foreign = await prisma.business.create({ data: { name: 'Foreign', slug: `for-${s}`, phone: '+33100000000' } });
      await prisma.membership.create({ data: { userId: user.id, businessId: older.id, role: 'TECHNICIAN', isTechnician: true, createdAt: new Date(Date.now() - 10_000) } });
      await prisma.membership.create({ data: { userId: user.id, businessId: newer.id, role: 'OWNER' } });
      const token = (await sessions.execute({ userId: user.id })).token;
      return { user, older, newer, foreign, token };
    }
    const me = (token: string, bid?: string) => {
      const r = request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`);
      return bid ? r.set('x-business-id', bid) : r;
    };

    it('defaults to the oldest membership (TECHNICIAN), not OWNER; explicit x-business-id selects the other', async () => {
      const { older, newer, token } = await seed();
      const d = await me(token).expect(200);
      expect(d.body.activeBusinessId).toBe(older.id);
      expect(d.body.activeMembership).toMatchObject({ businessId: older.id, role: 'TECHNICIAN' });
      expect(d.body.memberships.map((m: any) => m.businessId)).toEqual([older.id, newer.id]);
      const x = await me(token, newer.id).expect(200);
      expect(x.body.activeBusinessId).toBe(newer.id);
      expect(x.body.activeMembership).toMatchObject({ businessId: newer.id, role: 'OWNER' });
    });

    it('denies a foreign business header, revoked and expired tokens', async () => {
      const { foreign, user, token } = await seed();
      await me(token, foreign.id).expect(401);
      const revoked = await sessions.execute({ userId: user.id });
      await prisma.session.delete({ where: { id: revoked.id } });
      await me(revoked.token).expect(401);
      const expired = await sessions.execute({ userId: user.id });
      await prisma.session.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await me(expired.token).expect(401);
    });

    it('Bearer takes precedence over a cookie: invalid Bearer + valid cookie is denied; valid Bearer + invalid cookie passes', async () => {
      const { token } = await seed();
      await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer bogus').set('Cookie', `session=${token}`).expect(401);
      await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`).set('Cookie', 'session=bogus').expect(200);
    });
  });
});
