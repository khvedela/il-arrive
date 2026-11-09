import { Controller, Get, HttpException, HttpStatus, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AccessTokenGuard } from '../modules/auth/guards/access-token.guard';
import { RolesGuard } from '../modules/auth/guards/roles.guard';
import { Roles } from '../modules/auth/decorators/roles.decorator';
import { CurrentUser } from '../modules/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../modules/auth/auth-user';
import { GeoCacheService } from './geo.cache.service';
import { GeocodingResponse } from './geo.controller.interface';
import { GEOCODER_TOKEN, Geocoder } from './geocoder.interface';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(
    @Inject(GEOCODER_TOKEN) private readonly geocoder: Geocoder,
    private readonly cache: GeoCacheService,
  ) {}

  @Get('search')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.OWNER, Role.DISPATCHER)
  @ApiOperation({ summary: 'Address autocomplete / lat-lng resolution (cached, rate limited)' })
  async search(@CurrentUser() user: AuthenticatedUser, @Query('q') q: string): Promise<GeocodingResponse[]> {
    if (typeof q !== 'string' || q.trim() === '') {
      throw new HttpException('Missing query parameter "q"', HttpStatus.BAD_REQUEST);
    }
    if (!(await this.cache.allow(user.userId))) {
      throw new HttpException('Too many geocoding requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    const cached = await this.cache.get(q);
    if (cached) return cached;

    try {
      const results = (await this.geocoder.search(q)).map((r) => ({ label: r.label, lat: r.lat, lng: r.lng, score: r.score }));
      await this.cache.set(q, results);
      return results;
    } catch {
      throw new HttpException('Geocoding service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
