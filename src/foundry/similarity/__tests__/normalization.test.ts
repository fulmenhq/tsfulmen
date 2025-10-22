import { describe, expect, it } from 'vitest';
import { casefold, equalsIgnoreCase, normalize, stripAccents } from '../normalization.js';
import { getNormalizationCases } from './fixtures.js';

describe('normalization', () => {
  describe('normalize - fixture-driven tests', () => {
    const cases = getNormalizationCases();

    for (const testCase of cases) {
      it(testCase.description || `normalize("${testCase.input}")`, () => {
        const result = normalize(testCase.input, testCase.options);
        expect(result).toBe(testCase.expected);
      });
    }
  });

  describe('casefold', () => {
    it('converts to lowercase', () => {
      expect(casefold('HELLO')).toBe('hello');
      expect(casefold('MixedCase')).toBe('mixedcase');
    });

    it('handles Turkish locale for dotted i', () => {
      expect(casefold('İstanbul', 'tr')).toBe('istanbul');
    });

    it('preserves already lowercase', () => {
      expect(casefold('hello')).toBe('hello');
    });
  });

  describe('stripAccents', () => {
    it('removes acute accents', () => {
      expect(stripAccents('café')).toBe('cafe');
      expect(stripAccents('résumé')).toBe('resume');
    });

    it('removes diaeresis', () => {
      expect(stripAccents('naïve')).toBe('naive');
    });

    it('removes umlauts', () => {
      expect(stripAccents('Zürich')).toBe('Zurich');
    });

    it('handles multiple accent types', () => {
      expect(stripAccents('Café Münchën')).toBe('Cafe Munchen');
    });

    it('preserves non-accented characters', () => {
      expect(stripAccents('hello')).toBe('hello');
    });
  });

  describe('normalize', () => {
    it('trims whitespace by default', () => {
      expect(normalize('  hello  ')).toBe('hello');
      expect(normalize('\t\ntest\n\t')).toBe('test');
    });

    it('applies case folding by default', () => {
      expect(normalize('HELLO')).toBe('hello');
      expect(normalize('MixedCase')).toBe('mixedcase');
    });

    it('preserves accents by default', () => {
      expect(normalize('café')).toBe('café');
    });

    it('strips accents when option enabled', () => {
      expect(normalize('café', { stripAccents: true })).toBe('cafe');
      expect(normalize('naïve', { stripAccents: true })).toBe('naive');
    });

    it('applies Turkish locale when specified', () => {
      expect(normalize('İstanbul', { locale: 'tr' })).toBe('istanbul');
    });

    it('combines all transformations', () => {
      expect(normalize('  Café Münchën  ', { stripAccents: true })).toBe('cafe munchen');
    });
  });

  describe('equalsIgnoreCase', () => {
    it('compares case-insensitively', () => {
      expect(equalsIgnoreCase('HELLO', 'hello')).toBe(true);
      expect(equalsIgnoreCase('Test', 'test')).toBe(true);
    });

    it('handles whitespace differences', () => {
      expect(equalsIgnoreCase('  hello  ', 'hello')).toBe(true);
    });

    it('respects accent differences by default', () => {
      expect(equalsIgnoreCase('café', 'cafe')).toBe(false);
    });

    it('ignores accents when option enabled', () => {
      expect(equalsIgnoreCase('café', 'cafe', { stripAccents: true })).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(equalsIgnoreCase('hello', 'world')).toBe(false);
    });
  });
});
