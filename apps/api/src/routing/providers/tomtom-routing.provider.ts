import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoutingProvider, Point, RouteResult } from '../routing.interface';

interface TomTomResponse {
  routes?: {
    summary?: {
      lengthInMeters: number;
      travelTimeInSeconds: number;
      trafficDelayInSeconds?: number;
    };
  }[];
}

const BASE_URL = 'https://api.tomtom.com/routing/1/calculateRoute';
const BREAKER_COOLDOWN_MS = 30_000;

@Injectable()
export class TomTomRoutingProvider implements RoutingProvider {
  private readonly apiKey: string;
  private readonly timeoutMs = 5000;
  private readonly maxRetries = 2;
  private readonly circuitBreakerThreshold = 5;
  private failureCount = 0;
  private openedAt = 0;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TOMTOM_API_KEY') || '';
  }

  /** Open after N consecutive failed calls; half-open (one probe) once the cooldown elapsed. */
  private circuitBreakerOpen(): boolean {
    if (this.failureCount < this.circuitBreakerThreshold) return false;
    return Date.now() - this.openedAt < BREAKER_COOLDOWN_MS;
  }

  private recordSuccess(): void {
    this.failureCount = 0;
  }

  private recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.circuitBreakerThreshold) this.openedAt = Date.now();
  }

  private async requestTomTom(from: Point, to: Point): Promise<TomTomResponse> {
    // Traffic-aware "fastest" route departing now (TomTom rejects past departAt values).
    const params = new URLSearchParams({ key: this.apiKey, travelMode: 'car', routeType: 'fastest', traffic: 'true' });
    const url = `${BASE_URL}/${from.lat},${from.lng}:${to.lat},${to.lng}/json?${params.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'il-arrive-api' } });
      // Never put the URL (it carries the key) in an error message.
      if (!response.ok) throw new Error(`TomTom API error: ${response.status}`);
      return (await response.json()) as TomTomResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  // TomTom rejects explicit past departAt values, so traffic is always evaluated for "now".
  async route(from: Point, to: Point): Promise<RouteResult> {
    if (this.circuitBreakerOpen()) {
      throw new Error('TomTom circuit breaker is open');
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const summary = (await this.requestTomTom(from, to)).routes?.[0]?.summary;
        if (!summary) throw new Error('Invalid TomTom response: missing route summary');
        this.recordSuccess();
        return {
          durationS: summary.travelTimeInSeconds,
          distanceM: summary.lengthInMeters,
          trafficAware: true,
          source: 'tomtom',
        };
      } catch (error) {
        lastError = error;
        // 4xx (bad key / bad request) will not heal by retrying.
        if (error instanceof Error && /API error: 4\d\d/.test(error.message)) break;
      }
    }
    this.recordFailure();
    throw lastError;
  }
}
