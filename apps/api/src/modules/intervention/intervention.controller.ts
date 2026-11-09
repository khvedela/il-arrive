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
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Role } from '../../auth/role.decorator';
import { Role as RoleType } from '../../../contracts';
import { InterventionService } from './intervention.service';
import {
  AssignTechnicianDto,
  CreateInterventionDto,
  InterventionLocationDto,
  ReportDelayDto,
  TransitionAction,
  UpdateInterventionDto,
} from '../../../contracts';

@ApiTags('interventions')
@Controller('interventions')
export class InterventionController {
  constructor(private readonly interventionService: InterventionService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiOperation({ summary: 'Create a new intervention' })
  @ApiBody({ type: CreateInterventionDto })
  async createIntervention(
    @Body() dto: CreateInterventionDto,
  ): Promise<{ intervention: any; conflicts: any[] }> {
    const businessId = 'business-1';
    const actorId = 'actor-1';
    return this.interventionService.createIntervention(businessId, actorId, dto);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.OWNER, RoleType.DISPATCHER, RoleType.TECHNICIAN)
  @ApiOperation({ summary: 'List interventions' })
  @ApiQuery({ name: 'status', required: false, enum: ['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED'] })
  @ApiQuery({ name: 'technicianId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  async listInterventions(
    @Query('status') status?: string,
    @Query('technicianId') technicianId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<any[]> {
    const businessId = 'business-1';
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
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.OWNER, RoleType.DISPATCHER, RoleType.TECHNICIAN)
  @ApiOperation({ summary: 'Get today interventions grouped by status' })
  async getTodayInterventions(): Promise<any[]> {
    const businessId = 'business-1';
    return this.interventionService.getTodayInterventions(businessId);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.OWNER, RoleType.DISPATCHER, RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Get intervention by ID with timeline' })
  async getIntervention(@Param('id') id: string): Promise<any> {
    const businessId = 'business-1';
    return this.interventionService.getIntervention(businessId, id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiBody({ type: UpdateInterventionDto })
  @ApiOperation({ summary: 'Update intervention' })
  async updateIntervention(
    @Param('id') id: string,
    @Body() dto: UpdateInterventionDto,
  ): Promise<any> {
    const businessId = 'business-1';
    const actorId = 'actor-1';
    return this.interventionService.updateIntervention(businessId, id, actorId, dto);
  }

  @Patch(':id/assign')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiBody({ type: AssignTechnicianDto })
  @ApiOperation({ summary: 'Assign technician to intervention' })
  async assignTechnician(
    @Param('id') id: string,
    @Body() dto: AssignTechnicianDto,
  ): Promise<{ intervention: any; conflicts: any[] }> {
    const businessId = 'business-1';
    const actorId = 'actor-1';
    return this.interventionService.assignTechnician(businessId, id, actorId, dto);
  }

  @Patch(':id/cancel')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiBody({ type: TransitionAction })
  @ApiOperation({ summary: 'Cancel intervention' })
  async cancelIntervention(
    @Param('id') id: string,
    @Body() dto: TransitionAction,
  ): Promise<any> {
    const businessId = 'business-1';
    const actorId = 'actor-1';
    return this.interventionService.cancelIntervention(businessId, id, actorId, dto.reason || '');
  }

  @Patch(':id/reschedule')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.OWNER, RoleType.DISPATCHER)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiBody({ type: TransitionAction })
  @ApiOperation({ summary: 'Reschedule intervention' })
  async rescheduleIntervention(
    @Param('id') id: string,
    @Body() dto: TransitionAction,
  ): Promise<any> {
    const businessId = 'business-1';
    const actorId = 'actor-1';
    return this.interventionService.rescheduleIntervention(businessId, id, actorId, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Delete intervention' })
  async deleteIntervention(@Param('id') id: string): Promise<void> {
    const businessId = 'business-1';
    await this.interventionService.deleteIntervention(businessId, id, 'actor-1');
  }
}

@ApiTags('technician-interventions')
@Controller('tech/interventions')
export class TechnicianInterventionController {
  constructor(private readonly interventionService: InterventionService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.TECHNICIAN)
  @ApiOperation({ summary: 'Get technician\'s own interventions' })
  @ApiQuery({ name: 'status', required: false, enum: ['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED'] })
  async getMyInterventions(
    @Query('status') status?: string,
  ): Promise<any[]> {
    const businessId = 'business-1';
    const technicianId = 'technician-1';
    return this.interventionService.getMyInterventions(businessId, technicianId, status);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Get technician\'s intervention by ID' })
  async getMyIntervention(@Param('id') id: string): Promise<any> {
    const businessId = 'business-1';
    const technicianId = 'technician-1';
    return this.interventionService.getMyIntervention(businessId, id, technicianId);
  }

  @Patch(':id/en-route')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark intervention as en route' })
  async markAsEnRoute(@Param('id') id: string): Promise<void> {
    const businessId = 'business-1';
    const actorId = 'technician-1';
    await this.interventionService.enRouteIntervention(businessId, id, actorId);
  }

  @Patch(':id/stop')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop route for intervention' })
  async stopRoute(@Param('id') id: string): Promise<void> {
    const businessId = 'business-1';
    const actorId = 'technician-1';
    await this.interventionService.stopRouteIntervention(businessId, id, actorId);
  }

  @Patch(':id/arrived')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark intervention as arrived' })
  async markAsArrived(@Param('id') id: string): Promise<void> {
    const businessId = 'business-1';
    const actorId = 'technician-1';
    await this.interventionService.arrivedIntervention(businessId, id, actorId);
  }

  @Patch(':id/complete')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark intervention as completed' })
  async markAsComplete(@Param('id') id: string): Promise<void> {
    const businessId = 'business-1';
    const actorId = 'technician-1';
    await this.interventionService.completeIntervention(businessId, id, actorId);
  }

  @Patch(':id/delay')
  @UseGuards(AuthGuard, RolesGuard)
  @Role(RoleType.TECHNICIAN)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiBody({ type: ReportDelayDto })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Report delay for intervention' })
  async reportDelay(
    @Param('id') id: string,
    @Body() dto: ReportDelayDto,
  ): Promise<void> {
    const businessId = 'business-1';
    const actorId = 'technician-1';
    await this.interventionService.reportDelay(businessId, id, actorId, dto);
  }
}
