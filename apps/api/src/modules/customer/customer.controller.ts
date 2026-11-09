import { BadRequestException, Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Transform } from 'class-transformer';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth-user';

export class CreateCustomerBody {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone must be E.164' })
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

const SELECT = { id: true, name: true, phone: true, email: true } as const;

@ApiTags('customers')
@Controller('customers')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.OWNER, Role.DISPATCHER)
export class CustomerController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @ApiOperation({
    summary:
      'Find-or-create a customer by exact E.164 phone within the active business. 201 = created, 200 = existing customer returned unchanged (name/email are never overwritten).',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const businessId = user.activeBusinessId;
    const { customer, created } = await this.prisma.$transaction(async (tx) => {
      // Serialises concurrent creates of the same (business, phone) without a unique index, so
      // pre-existing duplicate rows can never make a migration or request fail.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer:${businessId}:${dto.phone}`}, 0))`;
      const existing = await tx.customer.findFirst({
        where: { businessId, phone: dto.phone },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: SELECT,
      });
      if (existing) return { customer: existing, created: false };
      const row = await tx.customer.create({
        data: { businessId, name: dto.name, phone: dto.phone, email: dto.email },
        select: SELECT,
      });
      return { customer: row, created: true };
    });
    res.status(created ? 201 : 200);
    return customer;
  }

  @Get()
  @ApiOperation({ summary: 'Search customers of the active business by name or phone' })
  search(@CurrentUser() user: AuthenticatedUser, @Query('q') q?: unknown) {
    if (q !== undefined && typeof q !== 'string') throw new BadRequestException('q must be a single string');
    const term = q?.trim();
    return this.prisma.customer.findMany({
      where: {
        businessId: user.activeBusinessId,
        ...(term && { OR: [{ name: { contains: term, mode: 'insensitive' } }, { phone: { contains: term } }] }),
      },
      select: SELECT,
      orderBy: { name: 'asc' },
      take: 20,
    });
  }
}
