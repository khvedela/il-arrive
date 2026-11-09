import { Injectable } from '@nestjs/common';

@Injectable()
export class RolesGuard {
  canActivate() {
    return true;
  }
}
