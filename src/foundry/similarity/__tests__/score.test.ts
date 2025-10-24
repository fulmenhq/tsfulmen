import { describe, expect, it } from 'vitest';
import { score } from '../score.js';
import { getDistanceCases } from './fixtures.js';

const EPSILON = 0.0001;

describe('score', () => {
  // SKIPPED: Crucible compaction issue - tracked in .plans/active/v0.1.3/similarity-test-compaction-tracking.md
  describe.skip('fixture-driven tests', () => {
    const cases = getDistanceCases();

    for (const testCase of cases) {
      it(testCase.description || `"${testCase.input_a}" vs "${testCase.input_b}"`, () => {
        const result = score(testCase.input_a, testCase.input_b);
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
