import { InviteMemberService } from './invite-member.service';

describe('InviteMemberService', () => {
  it('puts the business name (not "undefined") in the invite email', async () => {
    delete process.env.APP_NAME;
    process.env.FRONTEND_WEB_URL = 'http://localhost:4300';
    const send = jest.fn();
    const prisma = {
      membership: {
        findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      invitation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'inv1', expiresAt: new Date() }),
      },
      business: { findUnique: jest.fn().mockResolvedValue({ name: 'Plomberie Dupont' }) },
    };
    const svc = new InviteMemberService(prisma as never, { send } as never, { create: jest.fn() } as never);
    await svc.execute({ businessId: 'b1', inviterUserId: 'u1', email: 'tech@x.fr', role: 'TECHNICIAN' });
    const mail = send.mock.calls[0][0];
    expect(mail.subject).toBe('Invitation pour Plomberie Dupont');
    expect(mail.html).not.toContain('undefined');
    expect(mail.text).not.toContain('undefined');
  });
});
