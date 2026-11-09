import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
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
    lastName?: string;
    phone?: string;
  }) {
    const tokenHash = digestToken(token);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation');
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException('Invitation already accepted');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existingUser && !(await argon2.verify(existingUser.passwordHash, password))) {
      throw new UnauthorizedException('Invalid password');
    }
    const hashedPassword = existingUser ? undefined : await argon2.hash(password);

    // Claim + grant in one transaction: the conditional claim makes redemption single-use under
    // concurrency, and any failure rolls back the user, membership and claim together.
    const user = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('Invitation already accepted or expired');
      }

      const member =
        existingUser ??
        (await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash: hashedPassword as string,
            firstName,
            lastName: lastName ?? '',
            phone: phone || undefined,
          },
        }));

      await tx.membership.create({
        data: {
          userId: member.id,
          businessId: invitation.businessId,
          role: invitation.role,
          isTechnician: invitation.role === 'TECHNICIAN',
        },
      });
      return member;
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
