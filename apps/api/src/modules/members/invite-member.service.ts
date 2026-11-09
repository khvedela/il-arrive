import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { MailProvider } from '../mail/mail.provider';
import { digestToken, generateToken } from '../../common/tokens';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class InviteMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailProvider: MailProvider,
    private readonly auditLog: AuditLogService,
  ) {}

  async execute({
    businessId,
    inviterUserId,
    email,
    role,
  }: {
    businessId: string;
    inviterUserId: string;
    email: string;
    role: 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';
  }) {
    const inviter = await this.prisma.membership.findUnique({
      where: { userId_businessId: { userId: inviterUserId, businessId } },
    });
    if (!inviter || inviter.role !== 'OWNER') {
      throw new Error('Only owners can invite members');
    }

    const existingMember = await this.prisma.membership.findFirst({
      where: { businessId, user: { email } },
    });
    if (existingMember) {
      throw new Error('User is already a member');
    }

    const existingInvitation = await this.prisma.invitation.findFirst({
      where: { businessId, email, acceptedAt: null },
    });
    if (existingInvitation) {
      throw new Error('Invitation already exists');
    }

    const token = generateToken();
    const tokenHash = digestToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        businessId,
        email,
        role,
        tokenHash,
        expiresAt,
      },
    });

    const inviteLink = `${process.env.FRONTEND_WEB_URL}/invite/${token}`;
    await this.mailProvider.send({
      to: email,
      subject: `Invitation pour ${process.env.APP_NAME}`,
      html: `<p>Bonjour,</p><p>Vous avez été invité à rejoindre ${process.env.APP_NAME}.</p><p><a href="${inviteLink}">Cliquez ici pour accepter l'invitation</a></p><p>Ce lien expirera dans 7 jours.</p>`,
      text: `Bonjour,\n\nVous avez été invité à rejoindre ${process.env.APP_NAME}.\n\nCliquez sur ce lien pour accepter l'invitation: ${inviteLink}\n\nCe lien expirera dans 7 jours.`,
      idempotencyKey: `invite-${invitation.id}`,
    });

    await this.auditLog.create({
      businessId,
      actorUserId: inviterUserId,
      action: 'member_invited',
      targetType: 'Invitation',
      targetId: invitation.id,
    });

    return {
      id: invitation.id,
      email,
      role,
      expiresAt: invitation.expiresAt,
    };
  }
}
