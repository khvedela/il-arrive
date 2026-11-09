export interface Point {
  lat: number;
  lng: number;
}

export interface RouteResult {
  durationS: number;
  distanceM: number;
  trafficAware: boolean;
  source: string;
}

export interface RoutingProvider {
  route(from: Point, to: Point, options?: { departAt?: Date }): Promise<RouteResult>;
}
