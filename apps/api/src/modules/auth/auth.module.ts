import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CreateSessionService } from './create-session.service';
import { CreateUserService } from './create-user.service';
import { MailModule } from '../mail/mail.module';
import { BusinessModule } from '../business/business.module';
import { SessionMiddleware } from './session.middleware';

@Module({
  imports: [MailModule, BusinessModule],
  controllers: [AuthController],
  providers: [AuthService, CreateSessionService, CreateUserService, SessionMiddleware],
  exports: [AuthService, CreateSessionService, CreateUserService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
