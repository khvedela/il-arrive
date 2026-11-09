import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Get,
  Patch,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { SESSION_TTL_MS } from './create-session.service';
import { clearedCookieHeaders, newCsrfToken, sessionCookieHeaders } from './session-cookies';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new business and user' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    res.setHeader('Set-Cookie', sessionCookieHeaders(result.accessToken, newCsrfToken(), SESSION_TTL_MS));
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive session cookie' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    res.setHeader('Set-Cookie', sessionCookieHeaders(result.accessToken, newCsrfToken(), SESSION_TTL_MS));
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and invalidate session' })
  @ApiCookieAuth()
  @UseGuards(AccessTokenGuard)
  async logout(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.sessionId ?? '');
    res.setHeader('Set-Cookie', clearedCookieHeaders());
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user with memberships and active business' })
  @ApiCookieAuth()
  @UseGuards(AccessTokenGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.userId, user.activeBusinessId);
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
