import { Injectable } from '@nestjs/common';
import { Get, Controller, Query, HttpException, HttpStatus } from '@nestjs/common';
import { Geocoder } from './geocoder.interface';
import { GeocodingResponse } from './geo.controller.interface';

@Injectable()
@Controller('geo')
export class GeoController {
  constructor(private readonly geocoder: Geocoder) {}

  @Get('search')
  async search(@Query('q') q: string): Promise<GeocodingResponse[]> {
    if (!q || q.trim() === '') {
      throw new HttpException('Missing query parameter "q"', HttpStatus.BAD_REQUEST);
    }

    try {
      const results = await this.geocoder.search(q);

      return results.map((r: GeocodingResponse) => ({
        label: r.label,
        lat: r.lat,
        lng: r.lng,
        score: r.score,
      }));
    } catch {
      throw new HttpException('Geocoding service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
