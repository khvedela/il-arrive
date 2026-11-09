import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { InterventionController } from './intervention.controller';
import { InterventionService } from './intervention.service';

@Module({
  imports: [NotificationModule],
  controllers: [InterventionController],
  providers: [InterventionService],
  exports: [InterventionService],
})
export class InterventionModule {}
