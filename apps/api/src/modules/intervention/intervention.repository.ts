import { Injectable } from '@nestjs/common';
import type { Intervention, InterventionEvent, InterventionStatus, Prisma, TrackingLink } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { POSITION_RESET } from '../tracking/tracking.keys';
import type { TransitionPatch } from './intervention.state-machine';

export interface ListFilters {
  status?: InterventionStatus;
  technicianMembershipId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  skip?: number;
  take?: number;
}

export interface ScheduleConflict {
  interventionId: string;
  scheduledDate: Date;
  windowStart: Date;
  windowEnd: Date;
}

const PUBLIC_INCLUDE = {
  business: true,
  customer: true,
  technician: { include: { user: true } },
  trackingSessions: true,
} satisfies Prisma.InterventionInclude;

/** Dashboard rows show who/where without a second round-trip. */
const LIST_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  technician: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.InterventionInclude;

export type InterventionForPublic = Prisma.InterventionGetPayload<{ include: typeof PUBLIC_INCLUDE }>;

@Injectable()
export class InterventionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(interventionId: string, businessId: string): Promise<Intervention | null> {
    return this.prisma.intervention.findFirst({ where: { id: interventionId, businessId } });
  }

  list(businessId: string, filters: ListFilters = {}): Promise<Intervention[]> {
    const { status, technicianMembershipId, dateFrom, dateTo, skip = 0, take = 50 } = filters;
    return this.prisma.intervention.findMany({
      where: {
        businessId,
        ...(status && { status }),
        ...(technicianMembershipId && { technicianMembershipId }),
        ...((dateFrom || dateTo) && {
          scheduledDate: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) },
        }),
      },
      include: LIST_INCLUDE,
      skip,
      take: Math.min(take, 200),
      orderBy: { scheduledDate: 'asc' },
    });
  }

  /** A technician's own interventions scheduled in [from, to), with the customer's contact data. */
  listForTechnicianWithCustomer(businessId: string, technicianMembershipId: string, from: Date, to: Date) {
    return this.prisma.intervention.findMany({
      where: { businessId, technicianMembershipId, scheduledDate: { gte: from, lt: to } },
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { windowStart: 'asc' },
    });
  }

  findCustomer(customerId: string, businessId: string) {
    return this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, name: true, phone: true },
    });
  }

  async listToday(businessId: string): Promise<{ status: InterventionStatus; interventions: Intervention[] }[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const rows = await this.prisma.intervention.findMany({
      where: { businessId, scheduledDate: { gte: start, lt: end } },
      include: LIST_INCLUDE,
      orderBy: { windowStart: 'asc' },
    });
    const statuses: InterventionStatus[] = ['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED'];
    return statuses.map((status) => ({ status, interventions: rows.filter((r) => r.status === status) }));
  }

  create(data: Prisma.InterventionUncheckedCreateInput): Promise<Intervention> {
    return this.prisma.intervention.create({ data });
  }

  /** Tenant-scoped update that never changes status (details, assignment). */
  async updateDetails(
    interventionId: string,
    businessId: string,
    data: Prisma.InterventionUncheckedUpdateInput,
  ): Promise<Intervention | null> {
    const { count } = await this.prisma.intervention.updateMany({
      where: { id: interventionId, businessId },
      data,
    });
    return count ? this.findById(interventionId, businessId) : null;
  }

  /**
   * Applies a transition patch and writes its timeline event in one transaction.
   * Guarded on `fromStatus` so concurrent transitions cannot both win; returns null on a lost race.
   */
  async applyTransition(
    interventionId: string,
    businessId: string,
    fromStatus: InterventionStatus,
    patch: TransitionPatch,
    event: { type: string; actorUserId: string; payload: Prisma.InputJsonValue },
  ): Promise<Intervention | null> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.intervention.updateMany({
        where: { id: interventionId, businessId, status: fromStatus },
        data: patch,
      });
      if (!count) return null;
      await tx.interventionEvent.create({
        data: { interventionId, type: event.type, actorUserId: event.actorUserId, payload: event.payload },
      });
      if (patch.status === 'EN_ROUTE') {
        // One row per intervention (unique): a new en_route after stop_route reopens it from scratch;
        // a session that is somehow still active is left as it is.
        const fresh = { startedAt: new Date(), endedAt: null, ...POSITION_RESET, etaAt: null, etaComputedAt: null, etaSource: null };
        await tx.trackingSession.updateMany({ where: { interventionId, endedAt: { not: null } }, data: fresh });
        await tx.trackingSession.createMany({ data: [{ interventionId, startedAt: fresh.startedAt }], skipDuplicates: true });
      } else {
        // ARRIVED, COMPLETED, CANCELLED, stop_route and reschedule all end the location session.
        await tx.trackingSession.updateMany({
          where: { interventionId, endedAt: null },
          data: { endedAt: new Date(), ...POSITION_RESET },
        });
      }
      return tx.intervention.findFirst({ where: { id: interventionId, businessId } });
    });
  }

  async delete(interventionId: string, businessId: string): Promise<boolean> {
    const { count } = await this.prisma.intervention.deleteMany({ where: { id: interventionId, businessId } });
    return count > 0;
  }

  listEvents(interventionId: string, businessId: string): Promise<InterventionEvent[]> {
    return this.prisma.interventionEvent.findMany({
      where: { interventionId, intervention: { businessId } },
      orderBy: { createdAt: 'asc' },
    });
  }

  createEvent(interventionId: string, type: string, actorUserId: string, payload: Prisma.InputJsonValue) {
    return this.prisma.interventionEvent.create({ data: { interventionId, type, actorUserId, payload } });
  }

  async customerBelongsToBusiness(customerId: string, businessId: string): Promise<boolean> {
    return (await this.prisma.customer.count({ where: { id: customerId, businessId } })) > 0;
  }

  async isTechnicianOfBusiness(membershipId: string, businessId: string): Promise<boolean> {
    return (await this.prisma.membership.count({ where: { id: membershipId, businessId, isTechnician: true } })) > 0;
  }

  /** Resolves the caller's technician membership id for a business (the user id is not the membership id). */
  async findTechnicianMembershipId(userId: string, businessId: string): Promise<string | null> {
    const m = await this.prisma.membership.findFirst({
      where: { userId, businessId, isTechnician: true },
      select: { id: true },
    });
    return m?.id ?? null;
  }

  // --- tracking links (only the SHA-256 hash is ever stored) ---

  findActiveLinkByHash(tokenHash: string): Promise<TrackingLink | null> {
    return this.prisma.trackingLink.findFirst({ where: { tokenHash, revokedAt: null } });
  }

  findActiveLinkByIntervention(interventionId: string, businessId: string): Promise<TrackingLink | null> {
    return this.prisma.trackingLink.findFirst({
      where: { interventionId, intervention: { businessId }, revokedAt: null },
    });
  }

  /** Revokes every active link of the intervention and issues a new one atomically. */
  async replaceLink(interventionId: string, tokenHash: string, expiresAt: Date, db?: Prisma.TransactionClient): Promise<TrackingLink> {
    const replace = async (tx: Prisma.TransactionClient) => {
      // Serialise rotation per intervention: without this, two concurrent calls that both see
      // "no active link" would each create one. The partial unique index is the DB-level backstop.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${interventionId}))`;
      await tx.trackingLink.updateMany({
        where: { interventionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return tx.trackingLink.create({ data: { interventionId, tokenHash, expiresAt } });
    };
    return db ? replace(db) : this.prisma.$transaction(replace);
  }

  /** Takes the same per-intervention lock as replaceLink, so revoke and rotate are totally ordered. */
  async revokeLinks(interventionId: string, businessId: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${interventionId}))`;
      const { count } = await tx.trackingLink.updateMany({
        where: { interventionId, intervention: { businessId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return count;
    });
  }

  async extendLinks(interventionId: string, expiresAt: Date): Promise<void> {
    await this.prisma.trackingLink.updateMany({
      where: { interventionId, revokedAt: null },
      data: { expiresAt },
    });
  }

  findForPublic(interventionId: string): Promise<InterventionForPublic | null> {
    return this.prisma.intervention.findUnique({ where: { id: interventionId }, include: PUBLIC_INCLUDE });
  }

  async findConflicts(
    businessId: string,
    technicianMembershipId: string,
    windowStart: Date,
    windowEnd: Date,
    excludeInterventionId?: string,
  ): Promise<ScheduleConflict[]> {
    const rows = await this.prisma.intervention.findMany({
      where: {
        businessId,
        technicianMembershipId,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
        windowStart: { lt: windowEnd },
        windowEnd: { gt: windowStart },
        ...(excludeInterventionId && { id: { not: excludeInterventionId } }),
      },
      select: { id: true, scheduledDate: true, windowStart: true, windowEnd: true },
    });
    return rows.map(({ id, ...rest }) => ({ interventionId: id, ...rest }));
  }
}
