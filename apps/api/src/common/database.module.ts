import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Single shared PrismaService instance, visible to every feature module. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
