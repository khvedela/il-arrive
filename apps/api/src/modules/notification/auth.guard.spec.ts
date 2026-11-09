import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma.service';
import { CreateSessionService } from '../auth/create-session.service';
import { digestToken } from '../../common/tokens';
import { NotificationAuthGuard } from './auth.guard';

function setup(role = 'OWNER', expiresAt = new Date(Date.now() + 60000)) {
  const prisma = {
    session: { findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) =>
      where.tokenHash === digestToken('valid-token') ? { id: 'session', userId: 'u', expiresAt } : null) },
    membership: { findFirst: jest.fn(async () => ({ businessId: 'b', role })) },
  };
  const db = prisma as unknown as PrismaService;
  const guard = new NotificationAuthGuard(
    { get: () => ['OWNER', 'DISPATCHER'] } as unknown as Reflector,
    new CreateSessionService(db), db,
  );
  const req = { headers: {} as Record<string, string>, auth: undefined as unknown,
    header(name: string) { return this.headers[name]; } };
  const ctx = { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => undefined } as unknown as ExecutionContext;
  return { prisma, guard, req, ctx };
}

describe('notification session authentication', () => {
  it('ignores injected auth context and rejects absent, unknown and expired tokens', async () => {
    const { guard, req, ctx, prisma } = setup();
    req.auth = { userId: 'forged', businessId: 'b', role: 'OWNER' };
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    req.headers.authorization = 'Bearer unknown';
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
    const expired = setup('OWNER', new Date(Date.now() - 1));
    expired.req.headers.authorization = 'Bearer valid-token';
    await expect(expired.guard.canActivate(expired.ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('scopes tenant choice to current membership and derives role from the database', async () => {
    const { guard, req, ctx, prisma } = setup();
    req.headers = { authorization: 'Bearer valid-token', 'x-business-id': 'b' };
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.auth).toEqual({ userId: 'u', businessId: 'b', role: 'OWNER' });
    expect(prisma.membership.findFirst).toHaveBeenCalledWith({ where: { userId: 'u', businessId: 'b' }, orderBy: { createdAt: 'asc' } });
    prisma.membership.findFirst.mockResolvedValueOnce(null as never);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    prisma.membership.findFirst.mockResolvedValueOnce({ businessId: 'b', role: 'TECHNICIAN' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
