import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createParamDecorator } from '@nestjs/common';

export type AuthRole = 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';
/** Shape the (upcoming) auth module must attach to `request.auth`. */
export interface AuthContext {
  userId: string;
  businessId: string;
  role: AuthRole;
}

export const ROLES_KEY = 'notification:roles';
export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);
export const Auth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext => ctx.switchToHttp().getRequest().auth,
);

/**
 * Fail-closed: without an authenticated `request.auth` (set by the auth module,
 * SLA-6/8) every request is rejected. Replace with the shared session/roles guard
 * once it lands.
 */
@Injectable()
export class NotificationAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const auth: AuthContext | undefined = ctx.switchToHttp().getRequest().auth;
    if (!auth?.userId || !auth.businessId || !auth.role) throw new UnauthorizedException();
    const roles = this.reflector.get<AuthRole[]>(ROLES_KEY, ctx.getHandler());
    if (!roles?.length || !roles.includes(auth.role)) throw new ForbiddenException();
    return true;
  }
}
