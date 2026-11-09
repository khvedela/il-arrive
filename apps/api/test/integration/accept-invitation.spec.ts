/* eslint-disable @typescript-eslint/no-explicit-any -- test helpers */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../src/common/prisma.service';
import { DatabaseModule } from '../../src/common/database.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { MailProvider } from '../../src/modules/mail/mail.provider';
import { ACCEPT_INVITATION_ATTEMPTS } from '../../src/modules/auth/auth.controller';
import { digestToken } from '../../src/common/tokens';

jest.setTimeout(60_000);

function jar(res: request.Response): { cookie: string; csrf: string } {
  const pairs = ((res.headers['set-cookie'] as unknown as string[]) ?? []).map((c) => c.split(';')[0]);
  const csrf = decodeURIComponent(pairs.find((p) => p.startsWith('csrf_token='))?.split('=')[1] ?? '');
  return { cookie: pairs.join('; '), csrf };
}

describe('POST /auth/accept-invitation over real HTTP (Postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sent: { to: string; text: string }[] = [];
  let seq = 0;
  const n = () => `${Date.now()}-${++seq}`;
  const http = () => request(app.getHttpServer());
  // Each call is a distinct client (trust proxy), so the per-client throttle never couples unrelated tests.
  let ipSeq = 0;
  const accept = (ip = `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`) =>
    http().post('/auth/accept-invitation').set('X-Forwarded-For', ip);

  beforeAll(async () => {
    process.env.FRONTEND_WEB_URL = 'https://app.test';
    const mod = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), DatabaseModule, AuthModule],
    })
      .overrideProvider(MailProvider)
      .useValue({ send: async (m: any) => sent.push(m) && { providerMessageId: 'test' } })
      .compile();
    app = mod.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => app?.close());

  async function owner() {
    const res = await http()
      .post('/auth/register')
      .send({ email: `own-${n()}@x.test`, password: 'Sup3rSecret!pw', firstName: 'O', lastName: 'W', businessName: 'Biz', phone: '+33100000000' })
      .expect(201);
    return { ...jar(res), businessId: res.body.activeBusinessId as string };
  }

  async function invite(o: { cookie: string; csrf: string }, email: string, role = 'DISPATCHER') {
    sent.length = 0;
    await http().post('/members/invite').set('Cookie', o.cookie).set('x-csrf-token', o.csrf).send({ email, role }).expect(200);
    const m = /accept-invitation\/([A-Za-z0-9_-]{43})/.exec(sent[0].text);
    expect(m).not.toBeNull();
    return m![1];
  }

  const body = (token: string) => ({ token, password: 'Passw0rd!long', firstName: 'New', lastName: 'Member' });

  it('invite → accept → /auth/me: link matches the web route, token stored hashed, cookies set', async () => {
    const o = await owner();
    const email = `new-${n()}@x.test`;
    const token = await invite(o, email);

    const inv = await prisma.invitation.findFirstOrThrow({ where: { email } });
    expect(inv.tokenHash).toBe(digestToken(token));
    expect(inv.tokenHash).not.toContain(token);

    const res = await accept().send(body(token)).expect(201);
    expect(res.body).toMatchObject({ businessId: o.businessId, role: 'DISPATCHER' });
    const { cookie, csrf } = jar(res);
    expect(cookie).toContain('session=');
    expect(csrf).not.toBe('');

    const me = await http().get('/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.activeBusinessId).toBe(o.businessId);
    expect(me.body.activeMembership).toMatchObject({ role: 'DISPATCHER' });
    expect(me.body.user.email).toBe(email);
  });

  it('is single-use: replay is rejected (400) and sets no cookies', async () => {
    const o = await owner();
    const token = await invite(o, `reuse-${n()}@x.test`);
    await accept().send(body(token)).expect(201);
    const again = await accept().send(body(token)).expect(400);
    expect(again.headers['set-cookie']).toBeUndefined();
  });

  it('rejects expired and unknown/foreign tokens without creating users or memberships', async () => {
    const o = await owner();
    const email = `exp-${n()}@x.test`;
    const token = await invite(o, email);
    await prisma.invitation.updateMany({ where: { email }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await accept().send(body(token)).expect(400);
    expect(expired.headers['set-cookie']).toBeUndefined();
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();

    await accept().send(body('x'.repeat(43))).expect(400);
    // a session/CSRF/other-looking token (not an invitation token) is foreign too
    const other = await owner();
    await accept().send(body(other.csrf)).expect(400);
  });

  it('validates the payload', async () => {
    await accept().send({ token: 'a', password: 'short', firstName: 'N' }).expect(400);
    await accept().send({ token: 'a', password: 'Passw0rd!long' }).expect(400);
  });

  it('existing user joining a second business must prove their password', async () => {
    const a = await owner();
    const b = await owner();
    const email = `multi-${n()}@x.test`;
    await accept().send(body(await invite(a, email))).expect(201);
    const t2 = await invite(b, email);
    await accept().send({ ...body(t2), password: 'Wrong-pass-123' }).expect(401);
    await accept().send(body(t2)).expect(201);
  });

  it('throttles repeated wrong-password guesses per client: 429, no cookies, token stays unclaimed, other clients unaffected', async () => {
    const a = await owner();
    const b = await owner();
    const email = `thr-${n()}@x.test`;
    await accept().send(body(await invite(a, email))).expect(201);
    const token = await invite(b, email);
    const attacker = '203.0.113.7';

    const wrong = { ...body(token), password: 'Wrong-pass-123' };
    for (let i = 0; i < ACCEPT_INVITATION_ATTEMPTS; i++) await accept(attacker).send(wrong).expect(401);
    const blocked = await accept(attacker).send(body(token)).expect(429);
    expect(blocked.headers['set-cookie']).toBeUndefined();
    const inv = await prisma.invitation.findUniqueOrThrow({ where: { tokenHash: digestToken(token) } });
    expect(inv.acceptedAt).toBeNull();

    // a different client is not locked out and can legitimately redeem
    await accept('198.51.100.9').send(body(token)).expect(201);
  });
});
