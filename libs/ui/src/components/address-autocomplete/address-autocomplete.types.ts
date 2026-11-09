export interface AddressSuggestion {
  label: string;
  secondary: string;
  lat: number;
  lng: number;
}

export type AddressSearchFn = (query: string) => Promise<AddressSuggestion[]>;
