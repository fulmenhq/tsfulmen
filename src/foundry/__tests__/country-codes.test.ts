/**
 * Country Code catalog tests
 */

import { describe, expect, it } from 'vitest';
import {
  clearCountryCodeCache,
  getCountryByAlpha2,
  getCountryByAlpha3,
  getCountryByNumeric,
  listCountries,
} from '../country-codes.js';

describe('Country Code Catalog', () => {
  describe('getCountryByAlpha2', () => {
    it('should return country by alpha-2 code', async () => {
      const country = await getCountryByAlpha2('US');
      expect(country).toBeDefined();
      expect(country?.alpha2).toBe('US');
      expect(country?.alpha3).toBe('USA');
      expect(country?.name).toBe('United States of America');
    });

    it('should be case-insensitive', async () => {
      const us1 = await getCountryByAlpha2('US');
      const us2 = await getCountryByAlpha2('us');
      const us3 = await getCountryByAlpha2('Us');

      expect(us1).toEqual(us2);
      expect(us1).toEqual(us3);
    });

    it('should return null for unknown code', async () => {
      const country = await getCountryByAlpha2('XX');
      expect(country).toBeNull();
    });

    it('should return frozen immutable object', async () => {
      const country = await getCountryByAlpha2('US');
      expect(Object.isFrozen(country)).toBe(true);
    });

    it('should return defensive copy', async () => {
      const country1 = await getCountryByAlpha2('US');
      const country2 = await getCountryByAlpha2('US');
      expect(country1).not.toBe(country2);
      expect(country1).toEqual(country2);
    });
  });

  describe('getCountryByAlpha3', () => {
    it('should return country by alpha-3 code', async () => {
      const country = await getCountryByAlpha3('USA');
      expect(country).toBeDefined();
      expect(country?.alpha2).toBe('US');
      expect(country?.alpha3).toBe('USA');
    });

    it('should be case-insensitive', async () => {
      const usa1 = await getCountryByAlpha3('USA');
      const usa2 = await getCountryByAlpha3('usa');
      const usa3 = await getCountryByAlpha3('UsA');

      expect(usa1).toEqual(usa2);
      expect(usa1).toEqual(usa3);
    });

    it('should return null for unknown code', async () => {
      const country = await getCountryByAlpha3('XXX');
      expect(country).toBeNull();
    });
  });

  describe('getCountryByNumeric', () => {
    it('should return country by numeric code (string)', async () => {
      const country = await getCountryByNumeric('840');
      expect(country).toBeDefined();
      expect(country?.alpha2).toBe('US');
      expect(country?.numeric).toBe('840');
    });

    it('should return country by numeric code (number)', async () => {
      const country = await getCountryByNumeric(840);
      expect(country).toBeDefined();
      expect(country?.alpha2).toBe('US');
    });

    it('should handle left-padding for numeric codes', async () => {
      // Brazil is '076' in catalog
      const br1 = await getCountryByNumeric('076');
      const br2 = await getCountryByNumeric('76');
      const br3 = await getCountryByNumeric(76);

      expect(br1?.alpha2).toBe('BR');
      expect(br2?.alpha2).toBe('BR');
      expect(br3?.alpha2).toBe('BR');
      expect(br1).toEqual(br2);
      expect(br1).toEqual(br3);
    });

    it('should return null for unknown numeric code', async () => {
      const country = await getCountryByNumeric('999');
      expect(country).toBeNull();
    });
  });

  describe('listCountries', () => {
    it('should return all countries', async () => {
      const countries = await listCountries();
      expect(countries.length).toBe(5);
      expect(countries.every((c) => c.alpha2 && c.alpha3 && c.name)).toBe(true);
    });

    it('should return frozen immutable array', async () => {
      const countries = await listCountries();
      expect(countries.every((c) => Object.isFrozen(c))).toBe(true);
    });

    it('should include all 5 countries', async () => {
      const countries = await listCountries();
      const alpha2Codes = countries.map((c) => c.alpha2);

      expect(alpha2Codes).toContain('US');
      expect(alpha2Codes).toContain('CA');
      expect(alpha2Codes).toContain('JP');
      expect(alpha2Codes).toContain('DE');
      expect(alpha2Codes).toContain('BR');
    });
  });

  describe('clearCountryCodeCache', () => {
    it('should clear cache and reload', async () => {
      const country1 = await getCountryByAlpha2('US');
      clearCountryCodeCache();
      const country2 = await getCountryByAlpha2('US');

      expect(country1).toEqual(country2);
      expect(country1).not.toBe(country2);
    });
  });

  describe('All 5 Countries', () => {
    it('should have United States', async () => {
      const us = await getCountryByAlpha2('US');
      expect(us?.alpha2).toBe('US');
      expect(us?.alpha3).toBe('USA');
      expect(us?.numeric).toBe('840');
      expect(us?.name).toBe('United States of America');
    });

    it('should have Canada', async () => {
      const ca = await getCountryByAlpha2('CA');
      expect(ca?.alpha2).toBe('CA');
      expect(ca?.alpha3).toBe('CAN');
      expect(ca?.numeric).toBe('124');
      expect(ca?.name).toBe('Canada');
    });

    it('should have Japan', async () => {
      const jp = await getCountryByAlpha2('JP');
      expect(jp?.alpha2).toBe('JP');
      expect(jp?.alpha3).toBe('JPN');
      expect(jp?.numeric).toBe('392');
      expect(jp?.name).toBe('Japan');
    });

    it('should have Germany', async () => {
      const de = await getCountryByAlpha2('DE');
      expect(de?.alpha2).toBe('DE');
      expect(de?.alpha3).toBe('DEU');
      expect(de?.numeric).toBe('276');
      expect(de?.name).toBe('Germany');
    });

    it('should have Brazil', async () => {
      const br = await getCountryByAlpha2('BR');
      expect(br?.alpha2).toBe('BR');
      expect(br?.alpha3).toBe('BRA');
      expect(br?.numeric).toBe('076');
      expect(br?.name).toBe('Brazil');
    });
  });

  describe('Normalization', () => {
    it('should normalize alpha-2 to uppercase', async () => {
      const lowercase = await getCountryByAlpha2('us');
      const uppercase = await getCountryByAlpha2('US');
      expect(lowercase).toEqual(uppercase);
    });

    it('should normalize alpha-3 to uppercase', async () => {
      const lowercase = await getCountryByAlpha3('usa');
      const uppercase = await getCountryByAlpha3('USA');
      expect(lowercase).toEqual(uppercase);
    });

    it('should normalize numeric with left-padding', async () => {
      const padded = await getCountryByNumeric('076');
      const unpadded = await getCountryByNumeric('76');
      const number = await getCountryByNumeric(76);

      expect(padded).toEqual(unpadded);
      expect(padded).toEqual(number);
    });
  });

  describe('Cross-lookup consistency', () => {
    it('should return same country via different lookup methods', async () => {
      const byAlpha2 = await getCountryByAlpha2('US');
      const byAlpha3 = await getCountryByAlpha3('USA');
      const byNumeric = await getCountryByNumeric('840');

      expect(byAlpha2?.alpha2).toBe(byAlpha3?.alpha2);
      expect(byAlpha2?.alpha2).toBe(byNumeric?.alpha2);
    });
  });
});
