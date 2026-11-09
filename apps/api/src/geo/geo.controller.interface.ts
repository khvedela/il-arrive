export interface GeocodingResponse {
  label: string;
  lat: number;
  lng: number;
  score: number;
}

export interface GeoController {
  search(q: string): Promise<GeocodingResponse[]>;
}
