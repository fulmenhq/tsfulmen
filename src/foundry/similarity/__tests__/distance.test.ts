import { describe, expect, it } from 'vitest';
import { distance } from '../distance.js';
import { getDistanceCases } from './fixtures.js';

describe('distance', () => {
  describe('fixture-driven tests', () => {
    const cases = getDistanceCases();

    for (const testCase of cases) {
      it(testCase.description || `"${testCase.input_a}" vs "${testCase.input_b}"`, () => {
        const result = distance(testCase.input_a, testCase.input_b);
        expect(result).toBe(testCase.expected_distance);
      });
    }
  });

  describe('property tests', () => {
    it('identity: distance(a, a) === 0', () => {
      const strings = ['', 'test', 'hello', 'café', '🎉'];
      for (const s of strings) {
        expect(distance(s, s)).toBe(0);
      }
    });

    it('symmetry: distance(a, b) === distance(b, a)', () => {
      const pairs = [
        ['kitten', 'sitting'],
        ['hello', 'world'],
        ['café', 'cafe'],
        ['', 'test'],
      ];
      for (const [a, b] of pairs) {
        expect(distance(a, b)).toBe(distance(b, a));
      }
    });

    it('triangle inequality: distance(a, c) <= distance(a, b) + distance(b, c)', () => {
      const triples: [string, string, string][] = [
        ['cat', 'bat', 'rat'],
        ['test', 'best', 'rest'],
        ['abc', 'abd', 'acd'],
      ];
      for (const [a, b, c] of triples) {
        const ab = distance(a, b);
        const bc = distance(b, c);
        const ac = distance(a, c);
        expect(ac).toBeLessThanOrEqual(ab + bc);
      }
    });

    it('non-negativity: distance(a, b) >= 0', () => {
      const pairs = [
        ['hello', 'world'],
        ['', ''],
        ['test', 'test'],
      ];
      for (const [a, b] of pairs) {
        expect(distance(a, b)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('edge cases', () => {
    it('handles empty strings', () => {
      expect(distance('', '')).toBe(0);
      expect(distance('', 'hello')).toBe(5);
      expect(distance('world', '')).toBe(5);
    });

    it('handles single characters', () => {
      expect(distance('a', 'a')).toBe(0);
      expect(distance('a', 'b')).toBe(1);
    });

    it('handles grapheme clusters correctly', () => {
      expect(distance('👨‍👩‍👧‍👦', '👨‍👩‍👧‍👦')).toBe(0);
      expect(distance('café', 'cafe')).toBe(1);
    });
  });
});
