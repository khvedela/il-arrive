import { Injectable } from '@nestjs/common';
import type { Prisma, Intervention, InterventionEvent, TrackingLink } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class InterventionRepository {
  constructor(private prisma: PrismaService) {}

  async findById(interventionId: string, businessId: string): Promise<Intervention | null> {
    return this.prisma.intervention.findFirst({
      where: {
        id: interventionId,
        businessId,
      },
    });
  }

  async findManyByBusiness(
    businessId: string,
    options: {
      status?: Intervention['status'];
      technicianMembershipId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      skip?: number;
      take?: number;
    } = {},
  ): Promise<Intervention[]> {
    const { status, technicianMembershipId, dateFrom, dateTo, skip = 0, take = 50 } = options;

    const where: Prisma.InterventionWhereInput = {
      businessId,
      ...(status && { status }),
      ...(technicianMembershipId && { technicianMembershipId }),
      ...(dateFrom && dateTo && { scheduledDate: { gte: dateFrom, lte: dateTo } }),
      ...(dateFrom && !dateTo && { scheduledDate: { gte: dateFrom } }),
      ...(dateTo && !dateFrom && { scheduledDate: { lte: dateTo } }),
    };

    return this.prisma.intervention.findMany({
      where,
      skip,
      take,
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async findTodayByStatus(businessId: string): Promise<{ status: string; interventions: Intervention[] }[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const interventions = await this.prisma.intervention.findMany({
      where: {
        businessId,
        scheduledDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const grouped: Record<string, Intervention[]> = {
      SCHEDULED: [],
      EN_ROUTE: [],
      ARRIVED: [],
      COMPLETED: [],
      CANCELLED: [],
    };

    interventions.forEach((intervention) => {
      if (grouped[intervention.status]) {
        grouped[intervention.status].push(intervention);
      }
    });

    return Object.entries(grouped).map(([status, interventions]) => ({
      status,
      interventions,
    }));
  }

  async create(data: Prisma.InterventionCreateInput): Promise<Intervention> {
    return this.prisma.intervention.create({
      data,
    });
  }

  async update(
    interventionId: string,
    businessId: string,
    data: Prisma.InterventionUpdateInput,
  ): Promise<Intervention> {
    return this.prisma.intervention.update({
      where: {
        id: interventionId,
        businessId,
      },
      data,
    });
  }

  async delete(interventionId: string, businessId: string): Promise<Intervention> {
    return this.prisma.intervention.delete({
      where: {
        id: interventionId,
        businessId,
      },
    });
  }

  async findInterventionEvent(interventionId: string, businessId: string): Promise<InterventionEvent[]> {
    return this.prisma.interventionEvent.findMany({
      where: {
        interventionId,
        intervention: {
          businessId,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createInterventionEvent(data: Prisma.InterventionEventCreateInput): Promise<InterventionEvent> {
    return this.prisma.interventionEvent.create({
      data,
    });
  }

  async findTrackingLinkByTokenHash(tokenHash: string): Promise<TrackingLink | null> {
    return this.prisma.trackingLink.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gte: new Date(),
        },
      },
    });
  }

  async createTrackingLink(data: Prisma.TrackingLinkCreateInput): Promise<TrackingLink> {
    return this.prisma.trackingLink.create({
      data,
    });
  }

  async findTrackingLinkByInterventionId(
    interventionId: string,
    businessId: string,
  ): Promise<TrackingLink | null> {
    return this.prisma.trackingLink.findFirst({
      where: {
        interventionId,
        intervention: {
          businessId,
        },
        revokedAt: null,
        expiresAt: {
          gte: new Date(),
        },
      },
    });
  }

  async regenerateTrackingLink(
    trackingLinkId: string,
    businessId: string,
  ): Promise<TrackingLink | null> {
    const trackingLink = await this.prisma.trackingLink.findFirst({
      where: {
        id: trackingLinkId,
        intervention: {
          businessId,
        },
      },
    });

    if (!trackingLink) {
      return null;
    }

    await this.prisma.trackingLink.update({
      where: { id: trackingLinkId },
      data: {
        revokedAt: new Date(),
      },
    });

    return this.prisma.trackingLink.create({
      data: {
        interventionId: trackingLink.interventionId,
        tokenHash: trackingLink.tokenHash,
        createdAt: new Date(),
        expiresAt: new Date(),
      },
    });
  }

  async revokeTrackingLink(trackingLinkId: string, businessId: string): Promise<TrackingLink | null> {
    const trackingLink = await this.prisma.trackingLink.findFirst({
      where: {
        id: trackingLinkId,
        intervention: {
          businessId,
        },
      },
    });

    if (!trackingLink) {
      return null;
    }

    return this.prisma.trackingLink.update({
      where: { id: trackingLinkId },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async findConflicts(
    businessId: string,
    technicianMembershipId: string,
    windowStart: Date,
    windowEnd: Date,
    excludeInterventionId?: string,
  ): Promise<
    {
      interventionId: string;
      scheduledDate: Date;
      windowStart: Date;
      windowEnd: Date;
    }[]
  > {
    const where: Prisma.InterventionWhereInput = {
      businessId,
      technicianMembershipId,
      NOT: excludeInterventionId ? { id: excludeInterventionId } : undefined,
      AND: [
        {
          OR: [
            { windowStart: { lte: windowEnd } },
            { windowEnd: { gte: windowStart } },
          ],
        },
        {
          NOT: [
            {
              AND: [
                { windowEnd: { lte: windowStart } },
                { windowStart: { gte: windowEnd } },
              ],
            },
          ],
        },
      ],
      status: {
        notIn: ['CANCELLED', 'COMPLETED'],
      },
    };

    return this.prisma.intervention.findMany({
      where,
      select: {
        id: true,
        scheduledDate: true,
        windowStart: true,
        windowEnd: true,
      },
    }).then((rows) => rows.map(({ id, ...rest }) => ({ interventionId: id, ...rest })));
  }
}
