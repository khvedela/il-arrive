import { Module } from '@nestjs/common';
import { ETAStalenessPolicyService } from './eta-staleness-policy.service';

@Module({
  providers: [ETAStalenessPolicyService],
  exports: [ETAStalenessPolicyService],
})
export class ETAModule {}
