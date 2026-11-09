import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class RemoveMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async execute({ businessId, actorUserId, memberId }: {
    businessId: string;
    actorUserId: string;
    memberId: string;
  }) {
    const actor = await this.prisma.membership.findUnique({
      where: { userId_businessId: { userId: actorUserId, businessId } },
    });
    if (!actor || actor.role !== 'OWNER') {
      throw new UnauthorizedException('Only owners can remove members');
    }

    if (actorUserId === memberId) {
      throw new BadRequestException('Cannot remove yourself from the business');
    }

    const member = await this.prisma.membership.findUnique({
      where: { userId_businessId: { userId: memberId, businessId } },
    });
    if (!member) {
      throw new BadRequestException('Member not found');
    }

    if (member.role === 'OWNER') {
      const ownerCount = await this.prisma.membership.count({
        where: { businessId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }

    await this.prisma.membership.delete({
      where: { userId_businessId: { userId: memberId, businessId } },
    });

    await this.auditLog.create({
      businessId,
      actorUserId,
      action: 'member_removed',
      targetType: 'Membership',
      targetId: member.id,
    });

    return { success: true };
  }
}
