import { Test, TestingModule } from '@nestjs/testing';
import { BanGeocoder } from './ban-geocoder.provider';

describe('BanGeocoder', () => {
  let provider: BanGeocoder;
  let fetchSpy: jest.SpyInstance;

  const mockResponse = {
    type: 'FeatureCollection',
    version: '1.0.0',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [2.3546789, 48.8564789],
        },
        properties: {
          label: '10 Rue de la Paix, 75002 Paris',
          name: '10 Rue de la Paix',
          postcode: '75002',
          citycode: '75102',
          score: 0.9678,
          city: 'Paris',
          context: '75, Paris, Île-de-France',
          type: 'housenumber',
          id: 'ADRESSE0000000000000000',
          importance: 0.8542,
          street: 'Rue de la Paix',
        },
      },
    ],
    limit: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BanGeocoder],
    }).compile();

    provider = module.get<BanGeocoder>(BanGeocoder);

    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should return results for search', async () => {
    const results = await provider.search('10 rue de la Paix, Paris');

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    expect(results[0].label).toContain('Paix');
    expect(results[0].lat).toBe(48.8564789);
    expect(results[0].lng).toBe(2.3546789);
    expect(results[0].score).toBe(0.9678);
  }, 10000);

  it('should return results for autocomplete', async () => {
    const autocompleteMockResponse = {
      type: 'FeatureCollection',
      version: '1.0.0',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [2.3546789, 48.8564789],
          },
          properties: {
            label: '10 Rue de la Paix, 75002 Paris',
            name: '10 Rue de la Paix',
            score: 0.9678,
            city: 'Paris',
            context: '75, Paris, Île-de-France',
            type: 'housenumber',
          },
        },
      ],
      limit: 3,
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => autocompleteMockResponse,
    } as Response);

    const results = await provider.autocomplete('rue de la', 3);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
  }, 10000);

  it('should handle empty query', async () => {
    const results = await provider.search('');

    expect(Array.isArray(results)).toBe(true);
  });

  it('should include address details', async () => {
    const results = await provider.search('10 rue de la Paix, Paris');

    expect(results.length).toBe(1);
    expect(results[0].address).toBeDefined();
    expect(results[0].address?.street).toBe('Rue de la Paix');
    expect(results[0].address?.city).toBe('Paris');
    expect(results[0].address?.country).toBe('France');
  });

  it('should reject invalid response', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    } as Response);

    await expect(provider.search('invalid')).rejects.toThrow('BAN API error');
  }, 10000);
});
