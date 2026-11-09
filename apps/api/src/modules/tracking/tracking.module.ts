import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from '../../common/redis.service';
import { ETAModule } from '../../eta/eta.module';
import { RoutingModule } from '../../routing/routing.module';
import { AuthModule } from '../auth/auth.module';
import { TrackingController } from './tracking.controller';
import { TrackingEtaService } from './tracking-eta.service';
import { TrackingEventsHub } from './tracking-events.hub';
import { TrackingLocationService } from './tracking-location.service';
import { TrackingMaintenanceProcessor, TrackingScheduler } from './tracking-maintenance.processor';
import { TrackingMaintenanceService } from './tracking-maintenance.service';
import { TrackingSessionService } from './tracking-session.service';
import { TRACKING_QUEUE } from './tracking.keys';

const core = [
  RedisService,
  TrackingEventsHub,
  TrackingSessionService,
  TrackingEtaService,
  TrackingLocationService,
  TrackingMaintenanceService,
];
const imports = [ConfigModule, AuthModule, ETAModule, RoutingModule.forRoot(), BullModule.registerQueue({ name: TRACKING_QUEUE })];

/** API process: ingestion endpoint + schedules the repeatable sweep job. */
@Module({
  imports,
  controllers: [TrackingController],
  providers: [...core, TrackingScheduler],
  exports: [TrackingSessionService, TrackingEventsHub],
})
export class TrackingModule {}

/** Worker process: consumes the sweep job (3 h expiry + stale push). */
@Module({
  imports,
  providers: [...core, TrackingMaintenanceProcessor],
  exports: [TrackingSessionService],
})
export class TrackingWorkerModule {}
