import { Injectable } from '@nestjs/common';
import { Geocoder, GeocodingResult } from './geocoder.interface';

interface BanResponse {
  type: string;
  version: string;
  features: {
    type: string;
    geometry: {
      type: string;
      coordinates: [number, number];
    };
    properties: {
      label: string;
      name: string;
      postcode?: string;
      citycode?: string;
      score: number;
      city?: string;
      context?: string;
      type: string;
      id: string;
      importance?: number;
      street?: string;
    };
  }[];
  limit?: number;
}

@Injectable()
export class BanGeocoder implements Geocoder {
  private readonly baseUrl = 'https://api-adresse.data.gouv.fr';
  private readonly timeoutMs = 10000;

  async search(query: string): Promise<GeocodingResult[]> {
    const url = `${this.baseUrl}/search/?q=${encodeURIComponent(query)}&limit=10`;
    return this.fetchFeatures(url);
  }

  async autocomplete(query: string, limit: number = 5): Promise<GeocodingResult[]> {
    const url = `${this.baseUrl}/autocomplete/?q=${encodeURIComponent(query)}&limit=${limit}`;
    return this.fetchFeatures(url);
  }

  private async fetchFeatures(url: string): Promise<GeocodingResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'il-arrive-api' },
      });

      if (!response.ok) {
        throw new Error(`BAN API error: ${response.status} ${response.statusText}`);
      }

      const data: BanResponse = await response.json();

      return data.features.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;

        return {
          label: props.label,
          lat,
          lng,
          score: props.score,
          address: {
            street: props.street,
            city: props.city,
            postcode: props.postcode,
            country: 'France',
          },
        };
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
