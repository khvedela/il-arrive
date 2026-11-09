import { Module } from '@nestjs/common';
import { ConsoleSmsProvider } from '../notification/providers/console-sms.provider';
import { DevSmsController } from './dev.controller';

@Module({
  imports: [],
  controllers: [DevSmsController],
  providers: [ConsoleSmsProvider],
  exports: [ConsoleSmsProvider],
})
export class DevModule {}
