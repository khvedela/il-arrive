import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as argon2 from 'argon2';
import { digestToken, generateToken } from '../../common/tokens';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { MailProvider } from '../mail/mail.provider';
import { CreateBusinessService } from '../business/create-business.service';
import { CreateUserService } from './create-user.service';
import { CreateSessionService } from './create-session.service';
import type { MeMembership, MeResponse } from '@il-arrive/contracts';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailProvider: MailProvider,
    private readonly createBusiness: CreateBusinessService,
    private readonly createUser: CreateUserService,
    private readonly createSession: CreateSessionService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await argon2.hash(dto.password);

    const business = await this.createBusiness.execute({
      name: dto.businessName,
      phone: dto.phone,
    });

    const user = await this.createUser.execute({
      email: dto.email,
      passwordHash: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
    });

    await this.prisma.membership.create({
      data: {
        userId: user.id,
        businessId: business.id,
        role: 'OWNER',
        isTechnician: dto.isTechnician ?? false,
      },
    });

    const session = await this.createSession.execute({ userId: user.id });

    const registeredMembership: MeMembership = {
      id: business.id,
      businessId: business.id,
      name: business.name,
      slug: business.slug,
      logoUrl: business.logoUrl,
      phone: business.phone,
      brandColor: business.brandColor,
      plan: business.plan,
      role: 'OWNER',
      isTechnician: dto.isTechnician ?? false,
      onboardingCompleted: false,
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
      memberships: [registeredMembership],
      activeBusinessId: business.id,
      activeMembership: registeredMembership,
      sessionId: session.id,
      accessToken: session.token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.createSession.execute({ userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
      sessionId: session.id,
      accessToken: session.token,
    };
  }

  async logout(sessionId: string) {
    if (!sessionId) {
      throw new UnauthorizedException('No active session');
    }
    await this.prisma.session.delete({
      where: { id: sessionId },
    });
  }

  async getMe(userId: string, activeBusinessId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const rows = await this.prisma.membership.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: { business: { include: { _count: { select: { customers: true, interventions: true } } } } },
    });
    const memberships: MeMembership[] = rows.map((m) => ({
      id: m.business.id,
      businessId: m.business.id,
      name: m.business.name,
      slug: m.business.slug,
      logoUrl: m.business.logoUrl,
      phone: m.business.phone,
      brandColor: m.business.brandColor,
      plan: m.business.plan,
      role: m.role,
      isTechnician: m.isTechnician,
      // No dedicated column yet: a business that has any customer or intervention is onboarded.
      onboardingCompleted: m.business._count.customers + m.business._count.interventions > 0,
    }));
    const activeMembership = memberships.find((m) => m.businessId === activeBusinessId);
    if (!activeMembership) {
      throw new UnauthorizedException('No membership for active business');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
      memberships,
      activeBusinessId: activeMembership.businessId,
      activeMembership,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return;
    }

    const token = generateToken();
    const tokenHash = digestToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetLink = `${this.config.get('FRONTEND_WEB_URL')}/reset-password/${token}`;
    await this.mailProvider.send({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe',
      html: `<p>Bonjour ${user.firstName},</p><p>Vous avez demandé à réinitialiser votre mot de passe.</p><p><a href="${resetLink}">Cliquez ici pour réinitialiser votre mot de passe</a></p><p>Ce lien expirera dans 15 minutes.</p><p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.</p>`,
      text: `Bonjour ${user.firstName},\n\nVous avez demandé à réinitialiser votre mot de passe.\n\nCliquez sur ce lien pour le réinitialiser: ${resetLink}\n\nCe lien expirera dans 15 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.`,
      idempotencyKey: `reset-password-${user.id}`,
    });
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = digestToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Token has expired');
    }

    const newHash = await argon2.hash(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newHash },
      }),
      this.prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      }),
    ]);
  }
}
