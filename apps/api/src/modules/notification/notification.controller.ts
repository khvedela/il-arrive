import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { NotificationKind } from '@prisma/client';
import { NotificationService } from './notification.service';
import { Auth, AuthContext, NotificationAuthGuard, Roles } from './auth.guard';

export class NotifyDto {
  @IsEnum(NotificationKind)
  kind!: NotificationKind;
}

@UseGuards(NotificationAuthGuard)
@Controller()
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('interventions/:id/notify')
  @Roles('OWNER', 'DISPATCHER')
  @HttpCode(HttpStatus.ACCEPTED)
  notify(@Auth() auth: AuthContext, @Param('id') id: string, @Body() dto: NotifyDto) {
    return this.notifications.request({
      interventionId: id,
      kind: dto.kind,
      manual: true,
      businessId: auth.businessId,
    });
  }

  /** Technicians only get messages for their own interventions. */
  @Get('interventions/:id/share-message')
  @Roles('OWNER', 'DISPATCHER', 'TECHNICIAN')
  shareMessage(@Auth() auth: AuthContext, @Param('id') id: string, @Query('kind') kind?: string) {
    if (kind && !Object.values(NotificationKind).includes(kind as NotificationKind)) {
      throw new BadRequestException('invalid_notification_kind');
    }
    const k = (kind as NotificationKind | undefined) ?? 'EN_ROUTE';
    return this.notifications.buildShareMessage(
      id,
      {
        businessId: auth.businessId,
        technicianUserId: auth.role === 'TECHNICIAN' ? auth.userId : undefined,
      },
      k,
    );
  }

  @Get('business/sms-usage')
  @Roles('OWNER', 'DISPATCHER')
  usage(@Auth() auth: AuthContext) {
    return this.notifications.getUsage(auth.businessId);
  }
}
