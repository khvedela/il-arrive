import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoutingProvider, Point, RouteResult } from '../routing.interface';

interface TomTomRequest {
  jsonp?: string;
  key: string;
  travelMode?: string;
  type?: string;
  latency?: number;
  arrivalTime?: string;
  optimize?: string;
  routeType?: string;
  traffic?: string;
  flags?: string;
  language?: string;
  maxAlternatives?: string;
  index?: string;
  groupArrivalTime?: string;
}

interface TomTomResponse {
  routes: {
    summary: {
      lengthInMeters: number;
      travelTimeInSeconds: number;
      trafficDelayInSeconds: number;
      trafficLengthInMeters: number;
    };
    legs: {
      points: { latitude: number; longitude: number }[];
    }[];
  }[];
}

@Injectable()
export class TomTomRoutingProvider implements RoutingProvider {
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private failureCount = 0;
  private readonly circuitBreakerThreshold = 5;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TOMTOM_API_KEY') || '';
    this.timeoutMs = 10000;
    this.maxRetries = 2;
  }

  private circuitBreakerOpen(): boolean {
    return this.failureCount >= this.circuitBreakerThreshold;
  }

  private recordSuccess(): void {
    this.failureCount = 0;
  }

  private recordFailure(): void {
    this.failureCount++;
  }

  private async requestTomTom(
    from: Point,
    to: Point,
    departAt: Date,
  ): Promise<TomTomResponse> {
    const url = 'https://api.tomtom.com/routing/1/directions/json';
    const departAtIso = departAt.toISOString();

    const params = new URLSearchParams({
      key: this.apiKey,
      travelMode: 'car',
      type: 'shortest',
      latency: '0',
      arrivalTime: departAtIso,
      optimize: 'timeAvoidClosed',
      routeType: 'fastest',
      traffic: 'true',
      flags: 'routeLayout:basic',
      language: 'en-US',
      lat0: from.lat.toString(),
      lon0: from.lng.toString(),
      lat1: to.lat.toString(),
      lon1: to.lng.toString(),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'il-arrive-api' },
      });

      if (!response.ok) {
        throw new Error(`TomTom API error: ${response.status} ${response.statusText}`);
      }

      const data: TomTomResponse = await response.json();
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async route(from: Point, to: Point, options?: { departAt?: Date }): Promise<RouteResult> {
    if (this.circuitBreakerOpen()) {
      throw new Error('TomTom circuit breaker is open');
    }

    const departAt = options?.departAt || new Date();

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const data = await this.requestTomTom(from, to, departAt);

        if (!data.routes?.[0]?.summary) {
          throw new Error('Invalid TomTom response: missing route summary');
        }

        const summary = data.routes[0].summary;
        const durationS = summary.travelTimeInSeconds;
        const distanceM = summary.lengthInMeters;

        this.recordSuccess();
        return {
          durationS,
          distanceM,
          trafficAware: true,
          source: 'tomtom',
        };
      } catch (error) {
        this.recordFailure();
        if (attempt === this.maxRetries) {
          throw error;
        }
      }
    }

    throw new Error('Routing failed after retries');
  }
}
