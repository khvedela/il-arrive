import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { DevSmsController } from './dev.controller';

@Module({ controllers: [DevSmsController], providers: [PrismaService] })
export class DevModule {}
