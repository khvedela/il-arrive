import { Module } from '@nestjs/common';
import { InterventionController, TechnicianInterventionController } from './intervention.controller';
import { InterventionService } from './intervention.service';
import { InterventionRepository } from './intervention.repository';
import { InterventionStateMachine } from './intervention.state-machine';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InterventionController, TechnicianInterventionController],
  providers: [InterventionService, InterventionRepository, InterventionStateMachine],
  exports: [InterventionService, InterventionRepository, InterventionStateMachine],
})
export class InterventionModule {}
