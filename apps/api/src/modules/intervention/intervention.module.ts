import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InterventionController, TechnicianInterventionController } from './intervention.controller';
import { InterventionRepository } from './intervention.repository';
import { InterventionService } from './intervention.service';
import { PublicTrackingController } from './public-tracking.controller';
import { PublicTrackingService } from './public-tracking.service';
import { TrackingLinkService } from './tracking-link.service';

@Module({
  imports: [AuthModule],
  controllers: [InterventionController, TechnicianInterventionController, PublicTrackingController],
  providers: [InterventionService, InterventionRepository, TrackingLinkService, PublicTrackingService],
  exports: [InterventionService, InterventionRepository, TrackingLinkService],
})
export class InterventionModule {}
