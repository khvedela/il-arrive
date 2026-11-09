import { CreateSessionService } from './create-session.service';
import { digestToken } from '../../common/tokens';

function fakePrisma() {
  const sessions: { id: string; userId: string; tokenHash: string; expiresAt: Date }[] = [];
  return {
    sessions,
    session: {
      create: async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const row = { id: `s${sessions.length + 1}`, ...data };
        sessions.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        sessions.find((s) => s.tokenHash === where.tokenHash) ?? null,
    },
  };
}

describe('session tokens', () => {
  it('returns the raw token once and stores only its digest; verify() accepts the raw token', async () => {
    const prisma = fakePrisma();
    const service = new CreateSessionService(prisma as never);
    const issued = await service.execute({ userId: 'u1' });

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(prisma.sessions[0].tokenHash).toBe(digestToken(issued.token));
    expect(prisma.sessions[0].tokenHash).not.toBe(issued.token);
    expect(await service.verify(issued.token)).toEqual({ sessionId: 's1', userId: 'u1' });
    // the stored digest is not itself a credential
    expect(await service.verify(prisma.sessions[0].tokenHash)).toBeNull();
    expect(await service.verify('')).toBeNull();
  });

  it('rejects expired sessions', async () => {
    const prisma = fakePrisma();
    const service = new CreateSessionService(prisma as never);
    const { token } = await service.execute({ userId: 'u1' });
    prisma.sessions[0].expiresAt = new Date(Date.now() - 1);
    expect(await service.verify(token)).toBeNull();
  });
});

describe('digestToken', () => {
  it('is deterministic (so reset/invitation tokens are redeemable by lookup)', () => {
    expect(digestToken('abc')).toBe(digestToken('abc'));
    expect(digestToken('abc')).not.toBe(digestToken('abd'));
  });
});
