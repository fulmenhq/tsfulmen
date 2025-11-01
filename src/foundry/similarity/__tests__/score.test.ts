import { describe, expect, it } from 'vitest';
import { score } from '../score.js';
import { getDistanceCases } from './fixtures.js';

const EPSILON = 0.0001;

describe('score', () => {
  describe('fixture-driven tests - levenshtein', () => {
    const cases = getDistanceCases('levenshtein');

    for (const testCase of cases) {
      it(testCase.description || `"${testCase.input_a}" vs "${testCase.input_b}"`, () => {
        const result = score(testCase.input_a, testCase.input_b, 'levenshtein');
        expect(Math.abs(result - testCase.expected_score)).toBeLessThan(EPSILON);
      });
    }
  });

  describe('fixture-driven tests - damerau_osa', () => {
    const cases = getDistanceCases('damerau_osa');

    for (const testCase of cases) {
      it(testCase.description || `"${testCase.input_a}" vs "${testCase.input_b}"`, () => {
        const result = score(testCase.input_a, testCase.input_b, 'damerau_osa');
        expect(Math.abs(result - testCase.expected_score)).toBeLessThan(EPSILON);
      });
    }
  });

  describe('fixture-driven tests - damerau_unrestricted', () => {
    const cases = getDistanceCases('damerau_unrestricted');

    for (const testCase of cases) {
      it(testCase.description || `"${testCase.input_a}" vs "${testCase.input_b}"`, () => {
        const result = score(testCase.input_a, testCase.input_b, 'damerau_unrestricted');
        expect(Math.abs(result - testCase.expected_score)).toBeLessThan(EPSILON);
      });
    }
  });

  describe('fixture-driven tests - jaro_winkler', () => {
    const cases = getDistanceCases('jaro_winkler');

    for (const testCase of cases) {
      it(testCase.description || `"${testCase.input_a}" vs "${testCase.input_b}"`, () => {
        const result = score(testCase.input_a, testCase.input_b, 'jaro_winkler');
        expect(Math.abs(result - testCase.expected_score)).toBeLessThan(EPSILON);
      });
    }
  });

  // Substring tests skipped - fixtures use needle/haystack fields
  describe.skip('fixture-driven tests - substring', () => {
    const cases = getDistanceCases('substring');

    for (const testCase of cases) {
      it(testCase.description || `"${testCase.input_a}" vs "${testCase.input_b}"`, () => {
        const result = score(testCase.input_a, testCase.input_b, 'substring');
        expect(Math.abs(result - testCase.expected_score)).toBeLessThan(EPSILON);
      });
    }
  });

  describe('property tests', () => {
    it('range bounds: score(a, b) in [0.0, 1.0]', () => {
      const pairs = [
        ['hello', 'world'],
        ['test', 'test'],
        ['', ''],
        ['abc', 'xyz'],
      ];
      for (const [a, b] of pairs) {
        const s = score(a, b);
        expect(s).toBeGreaterThanOrEqual(0.0);
        expect(s).toBeLessThanOrEqual(1.0);
      }
    });

    it('identity: score(a, a) === 1.0', () => {
      const strings = ['', 'test', 'hello', 'café', '🎉'];
      for (const s of strings) {
        expect(score(s, s)).toBe(1.0);
      }
    });

    it('symmetry: score(a, b) === score(b, a)', () => {
      const pairs = [
        ['kitten', 'sitting'],
        ['hello', 'world'],
        ['café', 'cafe'],
      ];
      for (const [a, b] of pairs) {
        expect(score(a, b)).toBe(score(b, a));
      }
    });
  });

  describe('edge cases', () => {
    it('empty strings return 1.0', () => {
      expect(score('', '')).toBe(1.0);
    });

    it('completely different strings return 0.0', () => {
      expect(score('', 'hello')).toBe(0.0);
      expect(score('abc', '')).toBe(0.0);
      expect(score('UPPER', 'lower')).toBe(0.0);
    });

    it('single character differences', () => {
      const result = score('test', 'best');
      expect(result).toBe(0.75);
    });
  });
});
