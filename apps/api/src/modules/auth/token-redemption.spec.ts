/* eslint-disable @typescript-eslint/no-explicit-any -- loose in-memory prisma fake */
import '../../test-env';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AcceptInvitationService } from '../members/accept-invitation.service';
import { InviteMemberService } from '../members/invite-member.service';
import { digestToken } from '../../common/tokens';

type Row = Record<string, any>;

/** Minimal in-memory prisma covering the reset-token and invitation tables. */
function fakePrisma() {
  const db = {
    users: [{ id: 'u1', email: 'a@x.fr', firstName: 'A', passwordHash: 'old' }] as Row[],
    resets: [] as Row[],
    invitations: [] as Row[],
    memberships: [{ id: 'm0', userId: 'u1', businessId: 'b1', role: 'OWNER' }] as Row[],
  };
  const prisma: any = {
    db,
    business: { findUnique: async () => ({ name: 'Plomberie Dupont' }) },
    user: {
      findUnique: async ({ where }: Row) => db.users.find((u) => u.email === where.email || u.id === where.id) ?? null,
      update: async ({ where, data }: Row) => Object.assign(db.users.find((u) => u.id === where.id)!, data),
      create: async ({ data }: Row) => {
        const u = { id: `u${db.users.length + 1}`, ...data };
        db.users.push(u);
        return u;
      },
    },
    passwordResetToken: {
      create: async ({ data }: Row) => db.resets.push({ id: `r${db.resets.length + 1}`, ...data }),
      findUnique: async ({ where }: Row) => db.resets.find((r) => r.tokenHash === where.tokenHash) ?? null,
      delete: async ({ where }: Row) => db.resets.splice(db.resets.findIndex((r) => r.id === where.id), 1),
    },
    invitation: {
      create: async ({ data }: Row) => {
        const i = { id: `i${db.invitations.length + 1}`, acceptedAt: null, ...data };
        db.invitations.push(i);
        return i;
      },
      findFirst: async () => null,
      findUnique: async ({ where }: Row) => db.invitations.find((i) => i.tokenHash === where.tokenHash) ?? null,
      update: async ({ where, data }: Row) => Object.assign(db.invitations.find((i) => i.id === where.id)!, data),
      updateMany: async ({ where, data }: Row) => {
        const rows = db.invitations.filter(
          (i) => i.id === where.id && i.acceptedAt === null && i.expiresAt > where.expiresAt.gt,
        );
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
    membership: {
      findUnique: async () => db.memberships[0],
      findFirst: async () => null,
      create: async ({ data }: Row) => db.memberships.push({ id: 'mx', ...data }),
    },
    $transaction: async (arg: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      // interactive transaction: snapshot, roll back on throw
      const snapshot = JSON.stringify(db, (_k, v) => v);
      const restore = JSON.parse(snapshot, (k, v) => (k.endsWith('At') && typeof v === 'string' ? new Date(v) : v));
      try {
        return await arg(prisma);
      } catch (e) {
        (Object.keys(db) as (keyof typeof db)[]).forEach((k) => db[k].splice(0, db[k].length, ...restore[k]));
        throw e;
      }
    },
  };
  return prisma;
}

describe('password reset token redemption', () => {
  const build = (prisma: any) => {
    const sent: Row[] = [];
    const service = new AuthService(
      prisma,
      { get: () => 'https://app.test' } as never,
      { send: async (m: Row) => sent.push(m) } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, sent };
  };
  const tokenFrom = (mail: Row) => /reset-password\/([A-Za-z0-9_-]+)/.exec(mail.text)![1];

  it('issues a token whose emailed raw value redeems once, then replay fails', async () => {
    const prisma = fakePrisma();
    const { service, sent } = build(prisma);
    await service.requestPasswordReset('a@x.fr');
    const token = tokenFrom(sent[0]);

    expect(prisma.db.resets[0].tokenHash).toBe(digestToken(token));
    expect(JSON.stringify(prisma.db.resets)).not.toContain(token);

    await service.resetPassword({ token, password: 'new-password-1' } as never);
    expect(prisma.db.users[0].passwordHash).not.toBe('old');
    await expect(service.resetPassword({ token, password: 'again-123456' } as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects expired and unknown tokens', async () => {
    const prisma = fakePrisma();
    const { service, sent } = build(prisma);
    await service.requestPasswordReset('a@x.fr');
    const token = tokenFrom(sent[0]);
    prisma.db.resets[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.resetPassword({ token, password: 'x'.repeat(12) } as never)).rejects.toThrow('expired');
    await expect(service.resetPassword({ token: 'nope', password: 'x'.repeat(12) } as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('invitation token redemption', () => {
  it('redeems the emailed raw token once; expired and replayed invitations fail', async () => {
    const prisma = fakePrisma();
    const sent: Row[] = [];
    const audit = { create: async () => undefined };
    const invite = new InviteMemberService(prisma, { send: async (m: Row) => sent.push(m) } as never, audit as never);
    const accept = new AcceptInvitationService(prisma, audit as never);

    await invite.execute({ businessId: 'b1', inviterUserId: 'u1', email: 'new@x.fr', role: 'DISPATCHER' });
    const raw = /([A-Za-z0-9_-]{43})/.exec(JSON.stringify(sent[0]).replace(/https?:\/\/[^\s"]*\//g, '$& '))?.[1];
    // Fall back to scanning the persisted digest if the mail template embeds the token differently.
    const stored = prisma.db.invitations[0].tokenHash;
    const token = [raw, ...(JSON.stringify(sent[0]).match(/[A-Za-z0-9_-]{43}/g) ?? [])].find(
      (t) => t && digestToken(t) === stored,
    );
    expect(token).toBeDefined();

    const args = { token: token!, password: 'password-12345', firstName: 'N', lastName: 'M' };
    await expect(accept.execute(args)).resolves.toMatchObject({ businessId: 'b1', role: 'DISPATCHER' });
    await expect(accept.execute(args)).rejects.toThrow('already accepted');

    prisma.db.invitations[0].acceptedAt = null;
    prisma.db.invitations[0].expiresAt = new Date(Date.now() - 1000);
    await expect(accept.execute(args)).rejects.toThrow('expired');
    await expect(accept.execute({ ...args, token: 'bogus' })).rejects.toThrow('Invalid');
  });

  async function invited() {
    const prisma = fakePrisma();
    const sent: Row[] = [];
    const audit = { create: async () => undefined };
    await new InviteMemberService(prisma, { send: async (m: Row) => sent.push(m) } as never, audit as never).execute({
      businessId: 'b1',
      inviterUserId: 'u1',
      email: 'new@x.fr',
      role: 'DISPATCHER',
    });
    const token = (JSON.stringify(sent[0]).match(/[A-Za-z0-9_-]{43}/g) ?? []).find(
      (t) => digestToken(t) === prisma.db.invitations[0].tokenHash,
    )!;
    return { prisma, accept: new AcceptInvitationService(prisma, audit as never), token };
  }
  const args = (token: string) => ({ token, password: 'password-12345', firstName: 'N', lastName: 'M' });

  it('rolls back user, membership and claim together when a write fails', async () => {
    const { prisma, accept, token } = await invited();
    const original = prisma.membership.create;
    prisma.membership.create = async () => {
      throw new Error('boom');
    };
    await expect(accept.execute(args(token))).rejects.toThrow('boom');
    expect(prisma.db.invitations[0].acceptedAt).toBeNull();
    expect(prisma.db.users).toHaveLength(1);
    expect(prisma.db.memberships).toHaveLength(1);

    prisma.membership.create = original; // retry after the fault succeeds exactly once
    await expect(accept.execute(args(token))).resolves.toMatchObject({ role: 'DISPATCHER' });
  });

  it('concurrent redemption of one token grants exactly one membership', async () => {
    const { prisma, accept, token } = await invited();
    const results = await Promise.allSettled([accept.execute(args(token)), accept.execute(args(token))]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(prisma.db.memberships.filter((m: Row) => m.businessId === 'b1' && m.role === 'DISPATCHER')).toHaveLength(1);
  });
});
