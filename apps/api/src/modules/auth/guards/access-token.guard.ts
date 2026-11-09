import { Injectable } from '@nestjs/common';

@Injectable()
export class AccessTokenGuard {
  canActivate() {
    return true;
  }
}
