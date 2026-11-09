import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as argon2 from 'argon2';
import { digestToken } from '../../common/tokens';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class AcceptInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async execute({ token, password, firstName, lastName, phone }: {
    token: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    const tokenHash = digestToken(token);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    if (invitation.acceptedAt) {
      throw new Error('Invitation already accepted');
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }

    const hashedPassword = await argon2.hash(password);

    let user = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: invitation.email,
          passwordHash: hashedPassword,
          firstName,
          lastName,
          phone: phone || undefined,
        },
      });
    } else {
      const passwordValid = await argon2.verify(user.passwordHash, password);
      if (!passwordValid) {
        throw new Error('Invalid password');
      }
    }

    await this.prisma.membership.create({
      data: {
        userId: user.id,
        businessId: invitation.businessId,
        role: invitation.role,
        isTechnician: invitation.role === 'TECHNICIAN',
      },
    });

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    await this.auditLog.create({
      businessId: invitation.businessId,
      actorUserId: user.id,
      action: 'member_invitation_accepted',
      targetType: 'Invitation',
      targetId: invitation.id,
    });

    return {
      userId: user.id,
      businessId: invitation.businessId,
      role: invitation.role,
    };
  }
}
