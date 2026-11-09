import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role as RoleType } from '@prisma/client';
import { InterventionService } from './intervention.service';
import {
  AssignTechnicianDto,
  CreateInterventionDto,
  ReportDelayDto,
  TransitionAction,
  UpdateInterventionDto,
} from '@il-arrive/contracts';

@ApiTags('interventions')
@Controller('interventions')
export class InterventionController {
  constructor(private readonly interventionService: InterventionService) {}

  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiOperation({ summary: 'Create a new intervention' })
  async createIntervention(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInterventionDto,
  ): Promise<unknown> {
    const businessId = user.activeBusinessId;
    const actorId = user.userId;
    return this.interventionService.createIntervention(businessId, actorId, dto);
  }

  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiOperation({ summary: 'List interventions' })
  @ApiQuery({ name: 'status', required: false, enum: ['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED'] })
  @ApiQuery({ name: 'technicianId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  async listInterventions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('technicianId') technicianId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<unknown> {
    const businessId = user.activeBusinessId;
    return this.interventionService.listInterventions(
      businessId,
      status,
      technicianId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
      skip,
      take,
    );
  }

  @Get('today')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiOperation({ summary: 'Get today interventions grouped by status' })
  async getTodayInterventions(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    const businessId = user.activeBusinessId;
    return this.interventionService.getTodayInterventions(businessId);
  }

  @Get(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Get intervention by ID with timeline' })
  async getIntervention(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<unknown> {
    const businessId = user.activeBusinessId;
    return this.interventionService.getIntervention(businessId, id);
  }

  @Patch(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Update intervention' })
  async updateIntervention(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInterventionDto,
  ): Promise<unknown> {
    const businessId = user.activeBusinessId;
    const actorId = user.userId;
    return this.interventionService.updateIntervention(businessId, id, actorId, dto);
  }

  @Patch(':id/assign')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Assign technician to intervention' })
  async assignTechnician(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignTechnicianDto,
  ): Promise<unknown> {
    const businessId = user.activeBusinessId;
    const actorId = user.userId;
    return this.interventionService.assignTechnician(businessId, id, actorId, dto);
  }

  @Patch(':id/cancel')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Cancel intervention' })
  async cancelIntervention(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionAction,
  ): Promise<unknown> {
    const businessId = user.activeBusinessId;
    const actorId = user.userId;
    return this.interventionService.cancelIntervention(businessId, id, actorId, dto.reason || '');
  }

  @Patch(':id/reschedule')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Reschedule intervention' })
  async rescheduleIntervention(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionAction,
  ): Promise<unknown> {
    const businessId = user.activeBusinessId;
    const actorId = user.userId;
    return this.interventionService.rescheduleIntervention(businessId, id, actorId, dto);
  }

  @Post(':id/tracking-link/regenerate')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Revoke the current tracking link and issue a new one (URL returned once)' })
  async regenerateTrackingLink(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.interventionService.regenerateTrackingLink(user.activeBusinessId, id);
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Delete intervention' })
  async deleteIntervention(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    const businessId = user.activeBusinessId;
    await this.interventionService.deleteIntervention(businessId, id);
  }
}

@ApiTags('technician-interventions')
@Controller('tech/interventions')
export class TechnicianInterventionController {
  constructor(private readonly interventionService: InterventionService) {}

  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER, RoleType.TECHNICIAN)
  @ApiOperation({ summary: 'Get technician\'s own interventions' })
  @ApiQuery({ name: 'status', required: false, enum: ['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED'] })
  async getMyInterventions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ): Promise<unknown> {
    const businessId = user.activeBusinessId;
    const technicianId = user.userId;
    return this.interventionService.getMyInterventions(businessId, technicianId, status);
  }

  @Get(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER, RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Get technician\'s intervention by ID' })
  async getMyIntervention(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<unknown> {
    const businessId = user.activeBusinessId;
    const technicianId = user.userId;
    return this.interventionService.getMyIntervention(businessId, id, technicianId);
  }

  @Patch(':id/en-route')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER, RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark intervention as en route' })
  async markAsEnRoute(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    const businessId = user.activeBusinessId;
    const actorId = user.userId;
    await this.interventionService.enRouteIntervention(businessId, id, actorId);
  }

  @Patch(':id/stop')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER, RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop route for intervention' })
  async stopRoute(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    const businessId = user.activeBusinessId;
    const actorId = user.userId;
    await this.interventionService.stopRouteIntervention(businessId, id, actorId);
  }

  @Patch(':id/arrived')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER, RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark intervention as arrived' })
  async markAsArrived(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    const businessId = user.activeBusinessId;
    const actorId = user.userId;
    await this.interventionService.arrivedIntervention(businessId, id, actorId);
  }

  @Patch(':id/complete')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER, RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark intervention as completed' })
  async markAsComplete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    const businessId = user.activeBusinessId;
    const actorId = user.userId;
    await this.interventionService.completeIntervention(businessId, id, actorId);
  }

  @Patch(':id/delay')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(RoleType.OWNER, RoleType.DISPATCHER, RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Report delay for intervention' })
  async reportDelay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReportDelayDto,
  ): Promise<void> {
    const businessId = user.activeBusinessId;
    const actorId = user.userId;
    await this.interventionService.reportDelay(businessId, id, actorId, dto);
  }
}
