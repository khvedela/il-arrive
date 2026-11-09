import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiConflictResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth-user';
import { LocationResult, TrackingLocationService } from './tracking-location.service';

@ApiTags('tracking')
@Controller('tech/interventions')
export class TrackingController {
  constructor(private readonly location: TrackingLocationService) {}

  @Post(':id/location')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.OWNER, Role.DISPATCHER, Role.TECHNICIAN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiParam({ name: 'id', required: true, description: 'Intervention ID' })
  @ApiOperation({ summary: 'Foreground location fix of the assigned technician (last fix only is stored)' })
  @ApiConflictResponse({ description: 'Not EN_ROUTE / no active session: the client must stop watching' })
  ingest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { lat: unknown; lng: unknown; accuracy: unknown; timestamp: unknown },
  ): Promise<LocationResult> {
    return this.location.ingest(user.activeBusinessId, user.userId, id, body ?? {});
  }
}
