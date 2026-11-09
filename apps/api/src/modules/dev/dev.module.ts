import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database.module';
import { DevSmsController } from './dev.controller';

@Module({ imports: [DatabaseModule], controllers: [DevSmsController] })
export class DevModule {}
