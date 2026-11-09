import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Intervention, InterventionEvent, InterventionStatus } from '@prisma/client';
import type {
  AssignTechnicianDto,
  CreateInterventionDto,
  ReportDelayDto,
  TransitionAction,
  UpdateInterventionDto,
} from '@il-arrive/contracts';
import { InterventionRepository, ScheduleConflict } from './intervention.repository';
import {
  DELAY_ALLOWED_STATUSES,
  TransitionActionType,
  TransitionParams,
  transition,
} from './intervention.state-machine';
import { TrackingSessionService } from '../tracking/tracking-session.service';
import { IssuedTrackingLink, TrackingLinkService, linkExpiry } from './tracking-link.service';

export interface InterventionWithTimeline {
  intervention: Intervention;
  timeline: InterventionEvent[];
}

const STATUSES: readonly InterventionStatus[] = ['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED'];

function parseDate(value: string | undefined, field: string): Date {
  const date = new Date(value ?? '');
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} must be a valid ISO date`);
  return date;
}

function parseStatus(status: string | undefined): InterventionStatus | undefined {
  if (status === undefined) return undefined;
  if (!(STATUSES as readonly string[]).includes(status)) throw new BadRequestException(`Unknown status ${status}`);
  return status as InterventionStatus;
}

@Injectable()
export class InterventionService {
  constructor(
    private readonly repository: InterventionRepository,
    private readonly trackingLinks: TrackingLinkService,
    private readonly trackingSessions: TrackingSessionService,
  ) {}

  // --- dispatcher / owner ---

  async createIntervention(
    businessId: string,
    actorId: string,
    dto: CreateInterventionDto,
  ): Promise<{ intervention: Intervention; trackingLink: IssuedTrackingLink }> {
    const windowStart = parseDate(dto.windowStart, 'windowStart');
    const windowEnd = parseDate(dto.windowEnd, 'windowEnd');
    if (windowStart >= windowEnd) throw new BadRequestException('windowStart must be before windowEnd');
    if (!(await this.repository.customerBelongsToBusiness(dto.customerId, businessId))) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }

    const intervention = await this.repository.create({
      businessId,
      customerId: dto.customerId,
      addressLabel: dto.addressLabel,
      addressLat: dto.addressLat,
      addressLng: dto.addressLng,
      scheduledDate: parseDate(dto.scheduledDate, 'scheduledDate'),
      windowStart,
      windowEnd,
      description: dto.description,
      status: 'SCHEDULED',
    });
    await this.repository.createEvent(intervention.id, 'intervention.created', actorId, {
      actorId,
      status: intervention.status,
    });

    // Links are generated at creation (ARCHITECTURE §4); the raw token is returned once, here.
    const trackingLink = await this.trackingLinks.issue(intervention.id, intervention.windowEnd);
    return { intervention, trackingLink };
  }

  async getIntervention(businessId: string, interventionId: string): Promise<InterventionWithTimeline> {
    const intervention = await this.requireIntervention(businessId, interventionId);
    return { intervention, timeline: await this.repository.listEvents(interventionId, businessId) };
  }

  listInterventions(
    businessId: string,
    status?: string,
    technicianId?: string,
    dateFrom?: Date,
    dateTo?: Date,
    skip?: number,
    take?: number,
  ): Promise<Intervention[]> {
    return this.repository.list(businessId, {
      status: parseStatus(status),
      technicianMembershipId: technicianId,
      dateFrom,
      dateTo,
      skip,
      take,
    });
  }

  getTodayInterventions(businessId: string) {
    return this.repository.listToday(businessId);
  }

  async updateIntervention(
    businessId: string,
    interventionId: string,
    actorId: string,
    dto: UpdateInterventionDto,
  ): Promise<{ intervention: Intervention; conflicts: ScheduleConflict[] }> {
    const current = await this.requireIntervention(businessId, interventionId);
    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
      throw new ForbiddenException(`Cannot update a ${current.status} intervention`);
    }

    const windowStart = dto.windowStart ? parseDate(dto.windowStart, 'windowStart') : current.windowStart;
    const windowEnd = dto.windowEnd ? parseDate(dto.windowEnd, 'windowEnd') : current.windowEnd;
    if (windowStart >= windowEnd) throw new BadRequestException('windowStart must be before windowEnd');

    const updated = await this.repository.updateDetails(interventionId, businessId, {
      windowStart,
      windowEnd,
      description: dto.description,
      internalNotes: dto.internalNotes,
    });
    if (!updated) throw new NotFoundException(`Intervention ${interventionId} not found`);

    if (dto.windowEnd) await this.repository.extendLinks(interventionId, linkExpiry(windowEnd));
    await this.repository.createEvent(interventionId, 'intervention.updated', actorId, { actorId });

    return { intervention: updated, conflicts: await this.conflictsFor(updated) };
  }

  async assignTechnician(
    businessId: string,
    interventionId: string,
    actorId: string,
    dto: AssignTechnicianDto,
  ): Promise<{ intervention: Intervention; conflicts: ScheduleConflict[] }> {
    const current = await this.requireIntervention(businessId, interventionId);
    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
      throw new ForbiddenException(`Cannot assign a ${current.status} intervention`);
    }
    if (!(await this.repository.isTechnicianOfBusiness(dto.technicianMembershipId, businessId))) {
      throw new NotFoundException(`Technician ${dto.technicianMembershipId} not found`);
    }

    const updated = await this.repository.updateDetails(interventionId, businessId, {
      technicianMembershipId: dto.technicianMembershipId,
    });
    if (!updated) throw new NotFoundException(`Intervention ${interventionId} not found`);

    await this.repository.createEvent(interventionId, 'intervention.assigned', actorId, {
      actorId,
      technicianMembershipId: dto.technicianMembershipId,
    });
    return { intervention: updated, conflicts: await this.conflictsFor(updated) };
  }

  cancelIntervention(businessId: string, interventionId: string, actorId: string, reason: string) {
    return this.perform(businessId, interventionId, actorId, 'cancel', { reason });
  }

  rescheduleIntervention(businessId: string, interventionId: string, actorId: string, dto: TransitionAction) {
    return this.perform(businessId, interventionId, actorId, 'reschedule', {
      reason: dto.reason,
      newScheduledDate: parseDate(dto.newScheduledDate, 'newScheduledDate'),
      newWindowStart: parseDate(dto.newWindowStart, 'newWindowStart'),
      newWindowEnd: parseDate(dto.newWindowEnd, 'newWindowEnd'),
    });
  }

  async deleteIntervention(businessId: string, interventionId: string): Promise<void> {
    if (!(await this.repository.delete(interventionId, businessId))) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }
  }

  /** Copy / resend / regenerate all rotate the token: the raw value of an existing link is unrecoverable. */
  regenerateTrackingLink(businessId: string, interventionId: string): Promise<IssuedTrackingLink> {
    return this.trackingLinks.regenerate(businessId, interventionId);
  }

  // --- technician (identified by user id; resolved to their membership) ---

  async getMyInterventions(businessId: string, userId: string, status?: string): Promise<Intervention[]> {
    const membershipId = await this.requireTechnicianMembership(businessId, userId);
    return this.repository.list(businessId, { status: parseStatus(status), technicianMembershipId: membershipId });
  }

  /** Today's (server-local day) interventions of the calling technician, with customer contact data. */
  async getMyToday(businessId: string, userId: string, now: Date = new Date()) {
    const membershipId = await this.requireTechnicianMembership(businessId, userId);
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const interventions = await this.repository.listForTechnicianWithCustomer(businessId, membershipId, from, to);
    return { date: from.toISOString().slice(0, 10), interventions };
  }

  async getMyIntervention(businessId: string, interventionId: string, userId: string) {
    const intervention = await this.requireAssigned(businessId, interventionId, userId);
    const [timeline, customer] = await Promise.all([
      this.repository.listEvents(interventionId, businessId),
      this.repository.findCustomer(intervention.customerId, businessId),
    ]);
    return { intervention, timeline, customer };
  }

  async enRouteIntervention(businessId: string, interventionId: string, userId: string) {
    await this.requireAssigned(businessId, interventionId, userId);
    return this.perform(businessId, interventionId, userId, 'en_route');
  }

  async stopRouteIntervention(businessId: string, interventionId: string, userId: string) {
    await this.requireAssigned(businessId, interventionId, userId);
    return this.perform(businessId, interventionId, userId, 'stop_route');
  }

  async arrivedIntervention(businessId: string, interventionId: string, userId: string) {
    await this.requireAssigned(businessId, interventionId, userId);
    return this.perform(businessId, interventionId, userId, 'arrived');
  }

  async completeIntervention(businessId: string, interventionId: string, userId: string) {
    await this.requireAssigned(businessId, interventionId, userId);
    return this.perform(businessId, interventionId, userId, 'complete');
  }

  /** Delay is an overlay (delayMinutes + reason) on SCHEDULED/EN_ROUTE, not a state. */
  async reportDelay(businessId: string, interventionId: string, userId: string, dto: ReportDelayDto): Promise<Intervention> {
    const intervention = await this.requireAssigned(businessId, interventionId, userId);
    if (!DELAY_ALLOWED_STATUSES.includes(intervention.status)) {
      throw new ConflictException(`Cannot report a delay on a ${intervention.status} intervention`);
    }
    if (!Number.isInteger(dto.delayMinutes) || dto.delayMinutes <= 0 || dto.delayMinutes > 24 * 60) {
      throw new BadRequestException('delayMinutes must be a positive integer (max 1440)');
    }
    const updated = await this.repository.updateDetails(interventionId, businessId, {
      delayMinutes: dto.delayMinutes,
      delayReason: dto.delayReason,
    });
    if (!updated) throw new NotFoundException(`Intervention ${interventionId} not found`);
    await this.repository.createEvent(interventionId, 'intervention.delayed', userId, {
      actorId: userId,
      delayMinutes: dto.delayMinutes,
      delayReason: dto.delayReason,
    });
    return updated;
  }

  // --- internals ---

  /** Loads, runs the pure transition(), persists patch + event atomically (guarded on the old status). */
  private async perform(
    businessId: string,
    interventionId: string,
    actorId: string,
    action: TransitionActionType,
    params: TransitionParams = {},
  ): Promise<Intervention> {
    const current = await this.requireIntervention(businessId, interventionId);
    const result = transition(current, action, actorId, params);
    if (!result.ok) {
      if (result.error === 'INVALID_PARAMS') throw new BadRequestException(result.message);
      throw new ConflictException(result.message);
    }

    const updated = await this.repository.applyTransition(interventionId, businessId, current.status, result.patch, {
      type: result.event.type,
      actorUserId: actorId,
      payload: JSON.parse(JSON.stringify(result.event.payload)),
    });
    if (!updated) throw new ConflictException('Intervention was modified concurrently, please retry');

    // The DB side of the session lifecycle ran in the transition transaction; this is the rest.
    if (result.to === 'EN_ROUTE') await this.trackingSessions.onSessionStarted(interventionId);
    else await this.trackingSessions.onSessionEnded(interventionId, action);

    if (action === 'reschedule' && result.patch.windowEnd) {
      await this.repository.extendLinks(interventionId, linkExpiry(result.patch.windowEnd));
    }
    return updated;
  }

  private async requireIntervention(businessId: string, interventionId: string): Promise<Intervention> {
    const intervention = await this.repository.findById(interventionId, businessId);
    if (!intervention) throw new NotFoundException(`Intervention ${interventionId} not found`);
    return intervention;
  }

  private async requireTechnicianMembership(businessId: string, userId: string): Promise<string> {
    const membershipId = await this.repository.findTechnicianMembershipId(userId, businessId);
    if (!membershipId) throw new ForbiddenException('Not a technician of this business');
    return membershipId;
  }

  private async requireAssigned(businessId: string, interventionId: string, userId: string): Promise<Intervention> {
    const membershipId = await this.requireTechnicianMembership(businessId, userId);
    const intervention = await this.requireIntervention(businessId, interventionId);
    if (intervention.technicianMembershipId !== membershipId) {
      throw new ForbiddenException(`Intervention ${interventionId} is not assigned to you`);
    }
    return intervention;
  }

  private async conflictsFor(i: Intervention): Promise<ScheduleConflict[]> {
    if (!i.technicianMembershipId) return [];
    return this.repository.findConflicts(i.businessId, i.technicianMembershipId, i.windowStart, i.windowEnd, i.id);
  }
}
