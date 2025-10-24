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

    // SKIPPED: Crucible compaction issue - tracked in .plans/active/v0.1.3/similarity-test-compaction-tracking.md
    it.skip('should have all expected categories', () => {
      const fixtures = loadFixtures();
      const categories = fixtures.test_cases.map((g) => g.category);

      expect(categories).toContain('distance');
      expect(categories).toContain('normalization');
      expect(categories).toContain('suggestions');
    });
  });

  describe('validateFixtures', () => {
    // SKIPPED: Schema Cartographer doesn't support #/definitions refs yet - tracked in .plans/active/v0.1.3/similarity-test-compaction-tracking.md
    it.skip('should validate fixtures against schema', async () => {
      const result = await validateFixtures();
      expect(result).toBe(true);
    });
  });

  describe('getDistanceCases', () => {
    // SKIPPED: Crucible compaction issue - tracked in .plans/active/v0.1.3/similarity-test-compaction-tracking.md
    it.skip('should return distance test cases', () => {
      const cases = getDistanceCases();

      expect(cases).toBeInstanceOf(Array);
      expect(cases.length).toBeGreaterThan(0);

      const firstCase = cases[0];
      expect(firstCase).toHaveProperty('input_a');
      expect(firstCase).toHaveProperty('input_b');
      expect(firstCase).toHaveProperty('expected_distance');
      expect(firstCase).toHaveProperty('expected_score');
    });

    // SKIPPED: Crucible compaction issue - tracked in .plans/active/v0.1.3/similarity-test-compaction-tracking.md
    it.skip('should include classic Levenshtein examples', () => {
      const cases = getDistanceCases();
      const kittenCase = cases.find((c) => c.input_a === 'kitten' && c.input_b === 'sitting');

      expect(kittenCase).toBeDefined();
      expect(kittenCase?.expected_distance).toBe(3);
    });
  });

  describe('getNormalizationCases', () => {
    // SKIPPED: Crucible compaction issue - tracked in .plans/active/v0.1.3/similarity-test-compaction-tracking.md
    it.skip('should return normalization test cases', () => {
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
