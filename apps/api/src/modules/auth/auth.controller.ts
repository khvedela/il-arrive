import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './auth-user';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { RequestPasswordResetDto } from './dtos/request-password-reset.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new business and user' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive session cookie' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and invalidate session' })
  @ApiCookieAuth()
  @UseGuards(AccessTokenGuard)
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logout(user.sessionId ?? '');
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user with memberships and active business' })
  @ApiCookieAuth()
  @UseGuards(AccessTokenGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.userId);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change password' })
  @ApiCookieAuth()
  @UseGuards(AccessTokenGuard)
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.userId, dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request password reset email' })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
