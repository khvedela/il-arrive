import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InterventionStateMachine, resolveConflict } from './intervention.state-machine';
import { InterventionRepository } from './intervention.repository';
import {
  createInterventionArrivedEvent,
  createInterventionCancelledEvent,
  createInterventionCompletedEvent,
  createInterventionCreatedEvent,
  createInterventionDelayedEvent,
  createInterventionEnRouteEvent,
  createInterventionRescheduledEvent,
  InterventionEvent,
} from './intervention.event';
import type {
  AssignTechnicianDto,
  CreateInterventionDto,
  InterventionLocationDto,
  ReportDelayDto,
  TransitionAction,
  UpdateInterventionDto,
} from '../../../contracts';

@Injectable()
export class InterventionService {
  constructor(
    private readonly interventionRepository: InterventionRepository,
    private readonly stateMachine: InterventionStateMachine,
  ) {}

  async createIntervention(
    businessId: string,
    actorId: string,
    dto: CreateInterventionDto,
  ): Promise<{ intervention: any; conflicts: any[] }> {
    const conflicts = await this.findConflicts(
      businessId,
      dto.technicianMembershipId,
      new Date(dto.windowStart),
      new Date(dto.windowEnd),
    );

    if (conflicts.length > 0 && dto.technicianMembershipId) {
      throw new ConflictException(`Technician has ${conflicts.length} conflicting interventions`);
    }

    const intervention = await this.interventionRepository.create({
      business: { connect: { id: businessId } },
      customerId: dto.customerId,
      technicianMembershipId: dto.technicianMembershipId || undefined,
      addressLabel: dto.addressLabel,
      addressLat: dto.addressLat,
      addressLng: dto.addressLng,
      scheduledDate: new Date(dto.scheduledDate),
      windowStart: new Date(dto.windowStart),
      windowEnd: new Date(dto.windowEnd),
      description: dto.description,
      status: 'SCHEDULED',
    });

    const createdEvent = createInterventionCreatedEvent({
      interventionId: intervention.id,
      actorId,
      customerId: dto.customerId,
      technicianMembershipId: dto.technicianMembershipId || undefined,
      status: intervention.status,
      scheduledDate: intervention.scheduledDate.toISOString(),
      windowStart: intervention.windowStart.toISOString(),
      windowEnd: intervention.windowEnd.toISOString(),
      addressLabel: dto.addressLabel,
      addressLat: dto.addressLat,
      addressLng: dto.addressLng,
      description: dto.description,
    });

    await this.emitEvent(businessId, intervention.id, createdEvent);

    return { intervention, conflicts };
  }

  async getIntervention(businessId: string, interventionId: string): Promise<any> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    const timeline = await this.interventionRepository.findInterventionEvent(interventionId, businessId);

    return {
      intervention,
      timeline,
    };
  }

  async updateIntervention(
    businessId: string,
    interventionId: string,
    actorId: string,
    dto: UpdateInterventionDto,
  ): Promise<any> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    if (intervention.status === 'COMPLETED' || intervention.status === 'CANCELLED') {
      throw new ForbiddenException(`Cannot update ${intervention.status} intervention`);
    }

    const updatedIntervention = await this.interventionRepository.update(interventionId, businessId, {
      status: updatedIntervention.status,
      windowStart: dto.windowStart ? new Date(dto.windowStart) : undefined,
      windowEnd: dto.windowEnd ? new Date(dto.windowEnd) : undefined,
      internalNotes: dto.internalNotes,
      cancelledReason: reason,
    });

    return {
      intervention: updatedIntervention,
      conflicts: [],
    };
  }

  async assignTechnician(
    businessId: string,
    interventionId: string,
    actorId: string,
    dto: AssignTechnicianDto,
  ): Promise<{ intervention: any; conflicts: any[] }> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    const conflicts = await this.findConflicts(
      businessId,
      dto.technicianMembershipId,
      intervention.windowStart,
      intervention.windowEnd,
      interventionId,
    );

    const updatedIntervention = await this.interventionRepository.update(interventionId, businessId, {
      technicianMembershipId: dto.technicianMembershipId,
    });

    return { intervention: updatedIntervention, conflicts };
  }

  async cancelIntervention(
    businessId: string,
    interventionId: string,
    actorId: string,
    reason: string,
  ): Promise<any> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    this.stateMachine.validateTransition(intervention, 'cancel');

    const { intervention: updatedIntervention, event } = await this.stateMachine.applyTransition(
      intervention,
      'cancel',
      actorId,
      reason,
    );

    const updatedIntervention = await this.interventionRepository.update(interventionId, businessId, {
      status: updatedIntervention.status,
      cancelledReason: reason,
    });

    const cancelledEvent = createInterventionCancelledEvent({
      interventionId: intervention.id,
      actorId,
      fromStatus: intervention.status,
      toStatus: updatedIntervention.status,
      action: 'cancel',
      reason,
    });

    await this.emitEvent(businessId, intervention.id, cancelledEvent);

    return updatedIntervention;
  }

  async rescheduleIntervention(
    businessId: string,
    interventionId: string,
    actorId: string,
    dto: TransitionAction,
  ): Promise<any> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    this.stateMachine.validateTransition(intervention, dto.action);

    const { intervention: updatedIntervention, event } = await this.stateMachine.applyTransition(
      intervention,
      dto.action,
      actorId,
      dto.reason,
      dto.newScheduledDate,
      dto.newWindowStart,
      dto.newWindowEnd,
    );

    const updateData: Prisma.InterventionUpdateInput = {
      status: updatedIntervention.status,
      cancelledReason: reason,
    };

    await this.interventionRepository.update(interventionId, businessId, updateData);

    const rescheduledEvent = createInterventionRescheduledEvent({
      interventionId: intervention.id,
      actorId,
      fromStatus: intervention.status,
      toStatus: updatedIntervention.status,
      action: dto.action,
      reason: dto.reason,
      newScheduledDate: dto.newScheduledDate,
      newWindowStart: dto.newWindowStart,
      newWindowEnd: dto.newWindowEnd,
    });

    await this.emitEvent(businessId, intervention.id, rescheduledEvent);

    return updatedIntervention;
  }

  async enRouteIntervention(
    businessId: string,
    interventionId: string,
    actorId: string,
  ): Promise<any> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    this.stateMachine.validateTransition(intervention, 'en_route');

    const { intervention: updatedIntervention, event } = await this.stateMachine.applyTransition(
      intervention,
      'en_route',
      actorId,
    );

    await this.interventionRepository.update(interventionId, businessId, {
      status: updatedIntervention.status,
    });

    const enRouteEvent = createInterventionEnRouteEvent({
      interventionId: intervention.id,
      actorId,
      fromStatus: intervention.status,
      toStatus: updatedIntervention.status,
      action: 'en_route',
    });

    await this.emitEvent(businessId, intervention.id, enRouteEvent);

    return updatedIntervention;
  }

  async stopRouteIntervention(
    businessId: string,
    interventionId: string,
    actorId: string,
  ): Promise<any> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    this.stateMachine.validateTransition(intervention, 'stop_route');

    const { intervention: updatedIntervention2, event } = await this.stateMachine.applyTransition(
      intervention,
      'stop_route',
      actorId,
      dto.reason,
    );

    await this.interventionRepository.update(interventionId, businessId, {
      status: updatedIntervention2.status,
      cancelledReason: dto.reason,
    });

    const stopRouteEvent = createInterventionEnRouteEvent({
      interventionId: intervention.id,
      actorId,
      fromStatus: intervention.status,
      toStatus: updatedIntervention2.status,
      action: 'stop_route',
      reason: dto.reason,
    });

    await this.emitEvent(businessId, intervention.id, stopRouteEvent);

    return updatedIntervention;
  }

  async arrivedIntervention(
    businessId: string,
    interventionId: string,
    actorId: string,
  ): Promise<any> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    this.stateMachine.validateTransition(intervention, 'arrived');

    const { intervention: updatedIntervention2, event } = await this.stateMachine.applyTransition(
      intervention,
      'arrived',
      actorId,
      dto.reason,
    );

    await this.interventionRepository.update(interventionId, businessId, {
      status: updatedIntervention2.status,
      cancelledReason: dto.reason,
    });

    const arrivedEvent = createInterventionArrivedEvent({
      interventionId: intervention.id,
      actorId,
      fromStatus: intervention.status,
      toStatus: updatedIntervention2.status,
      action: 'arrived',
      reason: dto.reason,
    });

    await this.emitEvent(businessId, intervention.id, arrivedEvent);

    return updatedIntervention;
  }

  async completeIntervention(
    businessId: string,
    interventionId: string,
    actorId: string,
  ): Promise<any> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    this.stateMachine.validateTransition(intervention, 'complete');

    const { intervention: updatedIntervention2, event } = await this.stateMachine.applyTransition(
      intervention,
      'complete',
      actorId,
      reason,
    );

    const updatedIntervention = await this.interventionRepository.update(interventionId, businessId, {
      status: updatedIntervention2.status,
      cancelledReason: reason,
    });

    const completedEvent = createInterventionCompletedEvent({
      interventionId: intervention.id,
      actorId,
      fromStatus: intervention.status,
      toStatus: updatedIntervention2.status,
      action: 'complete',
      reason,
    });

    await this.emitEvent(businessId, intervention.id, completedEvent);

    return updatedIntervention;
  }

  async reportDelay(
    businessId: string,
    interventionId: string,
    actorId: string,
    dto: ReportDelayDto,
  ): Promise<any> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    const delayedEvent = createInterventionDelayedEvent({
      interventionId: intervention.id,
      actorId,
      delayMinutes: dto.delayMinutes,
      delayReason: dto.delayReason,
    });

    await this.emitEvent(businessId, intervention.id, delayedEvent);

    return {
      intervention,
      delayedEvent,
    };
  }

  async findConflicts(
    businessId: string,
    technicianMembershipId: string,
    windowStart: Date,
    windowEnd: Date,
    excludeInterventionId?: string,
  ): Promise<any[]> {
    return this.interventionRepository.findConflicts(
      businessId,
      technicianMembershipId,
      windowStart,
      windowEnd,
      excludeInterventionId,
    );
  }

  async listInterventions(
    businessId: string,
    status?: string,
    technicianId?: string,
    dateFrom?: Date,
    dateTo?: Date,
    skip?: number,
    take?: number,
  ): Promise<any[]> {
    return this.interventionRepository.findManyByBusiness({
      businessId,
      status: status as any,
      technicianMembershipId: technicianId,
      dateFrom,
      dateTo,
      skip,
      take,
    });
  }

  async getTodayInterventions(businessId: string): Promise<any[]> {
    return this.interventionRepository.findTodayByStatus(businessId);
  }

  async deleteIntervention(
    businessId: string,
    interventionId: string,
    actorId: string,
  ): Promise<void> {
    await this.interventionRepository.delete(interventionId, businessId);
  }

  async getMyInterventions(
    businessId: string,
    technicianId: string,
    status?: string,
  ): Promise<any[]> {
    return this.interventionRepository.findManyByBusiness({
      businessId,
      status: status as any,
      technicianMembershipId: technicianId,
    });
  }

  async getMyIntervention(
    businessId: string,
    interventionId: string,
    technicianId: string,
  ): Promise<any> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }
    if (intervention.technicianMembershipId !== technicianId) {
      throw new ForbiddenException(`Intervention ${interventionId} not assigned to you`);
    }
    const timeline = await this.interventionRepository.findInterventionEvent(interventionId, businessId);
    return { intervention, timeline };
  }

  private async emitEvent(businessId: string, interventionId: string, event: InterventionEvent): Promise<void> {
    const interventionEvent = await this.interventionRepository.createInterventionEvent({
      intervention: { connect: { id: interventionId } },
      type: event.eventName,
      actorUserId: event.payload.actorId,
      payload: JSON.stringify(event.payload),
    });

    console.log(`[InterventionEvent] Intervention ${interventionId}: ${event.eventName}`);
  }
}
