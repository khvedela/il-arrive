import { Test, TestingModule } from '@nestjs/testing';
import { BanGeocoder } from './ban-geocoder.provider';
import { Geocoder } from '../geocoder.interface';

describe('BanGeocoder', () => {
  let provider: BanGeocoder;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BanGeocoder],
    }).compile();

    provider = module.get<BanGeocoder>(BanGeocoder);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should return results for search', async () => {
    const results = await provider.search('10 rue de la Paix, Paris');

    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0].label).toContain('Paix');
      expect(results[0].lat).toBeDefined();
      expect(results[0].lng).toBeDefined();
      expect(results[0].score).toBeGreaterThanOrEqual(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
    }
  }, 10000);

  it('should return results for autocomplete', async () => {
    const results = await provider.autocomplete('rue de la', 3);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeLessThanOrEqual(3);
  }, 10000);

  it('should handle empty query', async () => {
    const results = await provider.search('');

    expect(Array.isArray(results)).toBe(true);
  });

  it('should include address details', async () => {
    const results = await provider.search('10 rue de la Paix, Paris');

    if (results.length > 0) {
      expect(results[0].address).toBeDefined();
      expect(results[0].address?.street).toBeUndefined();
      expect(results[0].address?.city).toBeDefined();
      expect(results[0].address?.country).toBe('France');
    }
  }, 10000);
});
