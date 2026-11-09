import { Injectable } from '@nestjs/common';
import { RoutingProvider, Point, RouteResult } from './routing.interface';

@Injectable()
export class FakeRoutingProvider implements RoutingProvider {
  private readonly SPEED_KMH = 30;
  private readonly FACTOR = 1.4;

  async route(from: Point, to: Point, options?: { departAt?: Date }): Promise<RouteResult> {
    const R = 6371;
    const dLat = (to.lat - from.lat) * (Math.PI / 180);
    const dLng = (to.lng - from.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(from.lat * (Math.PI / 180)) *
        Math.cos(to.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
    const distanceM = distanceKm * 1000;
    const durationS = (distanceKm / this.SPEED_KMH) * 3600 * this.FACTOR;

    return {
      durationS: Math.round(durationS),
      distanceM: Math.round(distanceM),
      trafficAware: false,
      source: 'fake',
    };
  }
}
