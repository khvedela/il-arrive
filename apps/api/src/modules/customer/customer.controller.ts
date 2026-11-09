import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Create a customer in the active business' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerBody) {
    return this.prisma.customer.create({
      data: { businessId: user.activeBusinessId, name: dto.name.trim(), phone: dto.phone, email: dto.email },
      select: SELECT,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Search customers of the active business by name or phone' })
  search(@CurrentUser() user: AuthenticatedUser, @Query('q') q?: string) {
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
