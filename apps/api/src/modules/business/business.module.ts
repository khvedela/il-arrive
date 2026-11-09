import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { CreateBusinessService } from './create-business.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [BusinessController],
  providers: [BusinessService, CreateBusinessService],
  exports: [BusinessService, CreateBusinessService],
})
export class BusinessModule {}
