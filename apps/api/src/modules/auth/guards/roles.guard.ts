import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth-user';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Fail-closed: a route without @Roles(...) or a user without a matching role is rejected. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!required?.length || !request.user || !required.includes(request.user.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
