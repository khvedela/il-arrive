import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from '../auth-user';

/** Injects the authenticated principal; only valid on routes guarded by AccessTokenGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user as AuthenticatedUser;
});
