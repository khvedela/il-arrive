import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AccessTokenGuard {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: any): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromCookie(req);
    if (!token) {
      return false;
    }
    try {
      const payload = this.jwtService.verify(token);
      req.user = payload;
      return true;
    } catch {
      return false;
    }
  }

  private extractTokenFromCookie(req: Request): string | null {
    const cookie = req.headers.cookie;
    if (!cookie) return null;
    const tokenCookie = cookie.split(';').find((c) => c.trim().startsWith('token='));
    if (!tokenCookie) return null;
    return tokenCookie.split('=')[1];
  }
}
