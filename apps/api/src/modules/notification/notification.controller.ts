import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { NotificationKind } from '@prisma/client';
import { NotificationService } from './notification.service';

export class NotifyDto {
  @IsEnum(NotificationKind)
  kind!: NotificationKind;
}

// TODO(auth): add the session/roles guard + business scoping once the auth module lands.
@Controller('interventions/:id')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('notify')
  @HttpCode(HttpStatus.ACCEPTED)
  notify(@Param('id') id: string, @Body() dto: NotifyDto) {
    return this.notifications.request({ interventionId: id, kind: dto.kind, manual: true });
  }

  @Get('share-message')
  shareMessage(@Param('id') id: string, @Query('kind') kind?: NotificationKind) {
    const k = kind && kind in NotificationKind ? kind : 'EN_ROUTE';
    return this.notifications.buildShareMessage(id, k);
  }
}
