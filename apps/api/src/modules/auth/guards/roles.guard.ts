import { Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class RolesGuard {
  constructor() {}

  canActivate(context: any): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const roles = req.user?.roles;
    if (!roles) {
      return false;
    }
    return true;
  }
}
