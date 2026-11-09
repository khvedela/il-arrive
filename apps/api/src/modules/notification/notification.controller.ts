import {
  BadRequestException, Body, Controller, ExecutionContext, Get, HttpCode, HttpStatus, Param, Post, Query,
  UnauthorizedException, UseGuards, createParamDecorator,
} from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { NotificationKind, Role } from '@prisma/client';
import { NotificationService } from './notification.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth-user';

/** Session/CSRF-authenticated user (populated by SessionMiddleware; bearer tokens work too). */
const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw new UnauthorizedException();
  return user;
});
type Auth = NonNullable<AuthenticatedRequest['user']>;

export class NotifyDto {
  @IsEnum(NotificationKind)
  kind!: NotificationKind;
}

@UseGuards(AccessTokenGuard, RolesGuard)
@Controller()
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('interventions/:id/notify')
  @Roles(Role.OWNER, Role.DISPATCHER)
  @HttpCode(HttpStatus.ACCEPTED)
  notify(@CurrentUser() auth: Auth, @Param('id') id: string, @Body() dto: NotifyDto) {
    return this.notifications.request({
      interventionId: id,
      kind: dto.kind,
      manual: true,
      businessId: auth.activeBusinessId,
    });
  }

  /** Technicians only get messages for their own interventions. */
  @Get('interventions/:id/share-message')
  @Roles(Role.OWNER, Role.DISPATCHER, Role.TECHNICIAN)
  shareMessage(@CurrentUser() auth: Auth, @Param('id') id: string, @Query('kind') kind?: string) {
    if (kind && !Object.values(NotificationKind).includes(kind as NotificationKind)) {
      throw new BadRequestException('invalid_notification_kind');
    }
    const k = (kind as NotificationKind | undefined) ?? 'EN_ROUTE';
    return this.notifications.buildShareMessage(
      id,
      {
        businessId: auth.activeBusinessId,
        technicianUserId: auth.role === Role.TECHNICIAN ? auth.userId : undefined,
      },
      k,
    );
  }

  @Get('business/sms-usage')
  @Roles(Role.OWNER, Role.DISPATCHER)
  usage(@CurrentUser() auth: Auth) {
    return this.notifications.getUsage(auth.activeBusinessId);
  }
}
