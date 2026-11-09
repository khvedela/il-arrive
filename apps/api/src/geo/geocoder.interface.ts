export interface GeocodingResult {
  label: string;
  lat: number;
  lng: number;
  score: number;
  address?: {
    street?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
}

export interface Geocoder {
  search(query: string): Promise<GeocodingResult[]>;
  autocomplete(query: string, limit?: number): Promise<GeocodingResult[]>;
}
