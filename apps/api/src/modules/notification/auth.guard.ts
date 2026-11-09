import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma.service';
import { CreateSessionService } from '../auth/create-session.service';
import type { Request } from 'express';
import { createParamDecorator } from '@nestjs/common';

export type AuthRole = 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';
/** Tenant context derived from a verified session and a current membership. */
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

/** Resolves opaque bearer tokens using the shared session verifier; never trusts client roles. */
@Injectable()
export class NotificationAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: CreateSessionService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/i)?.[1];
    const session = token ? await this.sessions.verify(token) : null;
    if (!session) throw new UnauthorizedException();
    const businessId = req.header('x-business-id');
    const membership = await this.prisma.membership.findFirst({
      where: { userId: session.userId, ...(businessId ? { businessId } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) throw new ForbiddenException();
    const auth: AuthContext = { userId: session.userId, businessId: membership.businessId, role: membership.role };
    req.auth = auth;
    const roles = this.reflector.get<AuthRole[]>(ROLES_KEY, ctx.getHandler());
    if (!roles?.length || !roles.includes(auth.role)) throw new ForbiddenException();
    return true;
  }
}
