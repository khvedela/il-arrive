import { Injectable, NestMiddleware } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { CreateSessionService } from './create-session.service';
import type { AuthenticatedRequest } from './auth-user';
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, parseCookies } from './session-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function sameToken(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Populates `request.user` from the session (HttpOnly cookie, or `Authorization: Bearer` for
 * non-browser clients). Cookie-authenticated state-changing requests must carry a matching
 * `X-CSRF-Token` header (double-submit). Never rejects by itself: AccessTokenGuard stays fail-closed.
 */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(
    private readonly sessions: CreateSessionService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request & AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const bearer = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
      const token = bearer ?? cookies[SESSION_COOKIE];
      if (!token) return next();

      if (!bearer && !SAFE_METHODS.has(req.method)) {
        const header = req.headers[CSRF_HEADER];
        if (!sameToken(cookies[CSRF_COOKIE], Array.isArray(header) ? header[0] : header)) {
          res.status(403).json({ statusCode: 403, message: 'Invalid CSRF token' });
          return;
        }
      }

      const verified = await this.sessions.verify(token);
      if (!verified) return next();
      const wanted = req.headers['x-business-id'];
      const businessId = Array.isArray(wanted) ? wanted[0] : wanted;
      const membership = await this.prisma.membership.findFirst({
        where: { userId: verified.userId, ...(businessId ? { businessId } : {}) },
        orderBy: { createdAt: 'asc' },
      });
      if (membership) {
        req.user = {
          userId: verified.userId,
          activeBusinessId: membership.businessId,
          role: membership.role,
          sessionId: verified.sessionId,
        };
      }
      next();
    } catch (err) {
      next(err);
    }
  }
}
