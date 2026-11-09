import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class UpdateMemberRoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async execute({ businessId, actorUserId, memberId, role }: {
    businessId: string;
    actorUserId: string;
    memberId: string;
    role: 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';
  }) {
    const actor = await this.prisma.membership.findUnique({
      where: { userId_businessId: { userId: actorUserId, businessId } },
    });
    if (!actor || actor.role !== 'OWNER') {
      throw new UnauthorizedException('Only owners can change member roles');
    }

    const member = await this.prisma.membership.findUnique({
      where: { userId_businessId: { userId: memberId, businessId } },
    });
    if (!member) {
      throw new BadRequestException('Member not found');
    }

    if (member.role === 'OWNER' && role !== 'OWNER') {
      const ownerCount = await this.prisma.membership.count({
        where: { businessId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }

    const updated = await this.prisma.membership.update({
      where: { userId_businessId: { userId: memberId, businessId } },
      data: { role },
    });

    await this.auditLog.create({
      businessId,
      actorUserId,
      action: 'member_role_changed',
      targetType: 'Membership',
      targetId: member.id,
    });

    return {
      userId: updated.userId,
      role: updated.role,
    };
  }
}
