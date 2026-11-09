import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth-user';

/**
 * Fail-closed: only passes when upstream authentication has populated `request.user`.
 * Until the access-token verification middleware is wired in, protected routes reject every request.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.userId || !request.user.activeBusinessId) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
