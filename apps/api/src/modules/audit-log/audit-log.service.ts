import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create({
    businessId,
    actorUserId,
    action,
    targetType,
    targetId,
  }: {
    businessId: string;
    actorUserId?: string;
    action: string;
    targetType?: string;
    targetId?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action,
        targetType,
        targetId,
      },
    });
  }
}
