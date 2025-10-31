import { describe, expect, it } from 'vitest';
import {
  getDistanceCases,
  getNormalizationCases,
  getSuggestionCases,
  loadFixtures,
  validateFixtures,
} from './fixtures.js';

describe('similarity fixtures', () => {
  describe('loadFixtures', () => {
    it('should load fixtures from YAML file', () => {
      const fixtures = loadFixtures();

      expect(fixtures).toBeDefined();
      expect(fixtures.version).toBeDefined();
      expect(fixtures.test_cases).toBeInstanceOf(Array);
      expect(fixtures.test_cases.length).toBeGreaterThan(0);
    });

    it('should cache fixtures after first load', () => {
      const first = loadFixtures();
      const second = loadFixtures();

      expect(first).toBe(second);
    });

    it('should have all expected v2.0 categories', () => {
      const fixtures = loadFixtures();
      const categories = fixtures.test_cases.map((g) => g.category);

      // v2.0 uses per-metric categories
      expect(categories).toContain('levenshtein');
      expect(categories).toContain('damerau_osa');
      expect(categories).toContain('damerau_unrestricted');
      expect(categories).toContain('jaro_winkler');
      expect(categories).toContain('substring');
      expect(categories).toContain('normalization_presets');
      expect(categories).toContain('suggestions');
    });
  });

  describe('validateFixtures', () => {
    it('should validate fixtures against v2.0.0 schema', async () => {
      const result = await validateFixtures();
      expect(result).toBe(true);
    });
  });

  describe('getDistanceCases', () => {
    it('should return distance test cases from all metrics', () => {
      const cases = getDistanceCases();

      expect(cases).toBeInstanceOf(Array);
      expect(cases.length).toBeGreaterThan(0);

      const firstCase = cases[0];
      expect(firstCase).toHaveProperty('input_a');
      expect(firstCase).toHaveProperty('input_b');
      expect(firstCase).toHaveProperty('expected_distance');
      expect(firstCase).toHaveProperty('expected_score');
    });

    it('should include classic Levenshtein examples', () => {
      const cases = getDistanceCases('levenshtein');
      const kittenCase = cases.find((c) => c.input_a === 'kitten' && c.input_b === 'sitting');

      expect(kittenCase).toBeDefined();
      expect(kittenCase?.expected_distance).toBe(3);
      expect(kittenCase?.expected_score).toBeCloseTo(0.5714285714285714);
    });

    it('should return Damerau OSA test cases', () => {
      const cases = getDistanceCases('damerau_osa');
      expect(cases).toBeInstanceOf(Array);
      expect(cases.length).toBeGreaterThan(0);
    });

    it('should return Damerau unrestricted test cases', () => {
      const cases = getDistanceCases('damerau_unrestricted');
      expect(cases).toBeInstanceOf(Array);
      expect(cases.length).toBeGreaterThan(0);
    });
  });

  describe('getNormalizationCases', () => {
    it('should return normalization preset test cases', () => {
      const cases = getNormalizationCases();

      expect(cases).toBeInstanceOf(Array);
      expect(cases.length).toBeGreaterThan(0);

      const firstCase = cases[0];
      expect(firstCase).toHaveProperty('input');
      expect(firstCase).toHaveProperty('expected');
    });
  });

  describe('getSuggestionCases', () => {
    it('should return suggestion test cases', () => {
      const cases = getSuggestionCases();

      expect(cases).toBeInstanceOf(Array);
      expect(cases.length).toBeGreaterThan(0);

      const firstCase = cases[0];
      expect(firstCase).toHaveProperty('input');
      expect(firstCase).toHaveProperty('candidates');
      expect(firstCase).toHaveProperty('expected');
    });
  });
});
