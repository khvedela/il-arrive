import { SessionMiddleware } from './session.middleware';
import { clearedCookieHeaders, parseCookies, sessionCookieHeaders } from './session-cookies';
import type { CreateSessionService } from './create-session.service';
import type { PrismaService } from '../../common/prisma.service';

function build(valid = true) {
  const sessions = { verify: jest.fn(async (t: string) => (valid && t === 'tok' ? { sessionId: 's1', userId: 'u1' } : null)) };
  const prisma = { membership: { findFirst: jest.fn(async () => ({ businessId: 'b1', role: 'TECHNICIAN' })) } };
  const mw = new SessionMiddleware(sessions as unknown as CreateSessionService, prisma as unknown as PrismaService);
  return { mw, sessions, prisma };
}

function run(mw: SessionMiddleware, req: Record<string, unknown>) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  req.method ??= 'GET';
  req.headers ??= {};
  return mw.use(req as never, res as never, next).then(() => ({ res, next }));
}

describe('SessionMiddleware', () => {
  it('populates req.user from the session cookie on a safe request', async () => {
    const { mw } = build();
    const req: Record<string, unknown> = { headers: { cookie: 'session=tok; csrf_token=c' } };
    const { next } = await run(mw, req);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ userId: 'u1', activeBusinessId: 'b1', role: 'TECHNICIAN', sessionId: 's1' });
  });

  it('rejects a cookie-authenticated PATCH without a matching CSRF header', async () => {
    const { mw, sessions } = build();
    const { res, next } = await run(mw, { method: 'PATCH', headers: { cookie: 'session=tok; csrf_token=c' } });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(sessions.verify).not.toHaveBeenCalled();
    const bad = await run(mw, { method: 'PATCH', headers: { cookie: 'session=tok; csrf_token=c', 'x-csrf-token': 'other' } });
    expect(bad.res.status).toHaveBeenCalledWith(403);
  });

  it('accepts a cookie-authenticated PATCH with a matching CSRF header', async () => {
    const { mw } = build();
    const req: Record<string, unknown> = { method: 'PATCH', headers: { cookie: 'session=tok; csrf_token=c', 'x-csrf-token': 'c' } };
    await run(mw, req);
    expect(req.user).toBeDefined();
  });

  it('bearer tokens skip CSRF (not ambient credentials)', async () => {
    const { mw } = build();
    const req: Record<string, unknown> = { method: 'POST', headers: { authorization: 'Bearer tok' } };
    await run(mw, req);
    expect(req.user).toBeDefined();
  });

  it('leaves req.user unset for unknown/expired sessions and anonymous requests', async () => {
    const bad = build(false);
    const r1: Record<string, unknown> = { headers: { cookie: 'session=tok' } };
    await run(bad.mw, r1);
    expect(r1.user).toBeUndefined();
    const r2: Record<string, unknown> = { headers: {} };
    const { next } = await run(build().mw, r2);
    expect(next).toHaveBeenCalledWith();
    expect(r2.user).toBeUndefined();
  });
});

describe('session cookies', () => {
  it('issues HttpOnly session and script-readable csrf cookies, and clears both', () => {
    const [s, c] = sessionCookieHeaders('a b', 'csrf', 60_000);
    expect(s).toContain('session=a%20b');
    expect(s).toContain('HttpOnly');
    expect(c).toContain('csrf_token=csrf');
    expect(c).not.toContain('HttpOnly');
    expect(clearedCookieHeaders().every((h) => h.includes('Max-Age=0'))).toBe(true);
    expect(parseCookies('session=a%20b; csrf_token=csrf')).toEqual({ session: 'a b', csrf_token: 'csrf' });
  });
});
