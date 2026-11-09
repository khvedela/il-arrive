import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CreateSessionService } from './create-session.service';
import { CreateUserService } from './create-user.service';
import { MailModule } from '../mail/mail.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [MailModule, BusinessModule],
  controllers: [AuthController],
  providers: [AuthService, CreateSessionService, CreateUserService],
  exports: [AuthService, CreateSessionService, CreateUserService],
})
export class AuthModule {}
