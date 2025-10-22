import { describe, expect, it } from 'vitest';
import type { NormalizeOptions, Suggestion, SuggestOptions } from '../types.js';

describe('similarity types', () => {
  describe('Suggestion', () => {
    it('should have correct structure', () => {
      const suggestion: Suggestion = {
        value: 'test',
        score: 0.95,
      };

      expect(suggestion.value).toBe('test');
      expect(suggestion.score).toBe(0.95);
    });

    it('should accept any valid score between 0 and 1', () => {
      const suggestions: Suggestion[] = [
        { value: 'exact', score: 1.0 },
        { value: 'close', score: 0.75 },
        { value: 'far', score: 0.1 },
        { value: 'none', score: 0.0 },
      ];

      expect(suggestions).toHaveLength(4);
      expect(suggestions.every((s) => s.score >= 0 && s.score <= 1)).toBe(true);
    });
  });

  describe('SuggestOptions', () => {
    it('should allow all fields to be optional', () => {
      const options: SuggestOptions = {};
      expect(options).toBeDefined();
    });

    it('should accept individual fields', () => {
      const minScoreOnly: SuggestOptions = { minScore: 0.5 };
      const maxSuggestionsOnly: SuggestOptions = { maxSuggestions: 5 };
      const normalizeOnly: SuggestOptions = { normalize: false };

      expect(minScoreOnly.minScore).toBe(0.5);
      expect(maxSuggestionsOnly.maxSuggestions).toBe(5);
      expect(normalizeOnly.normalize).toBe(false);
    });

    it('should accept all fields together', () => {
      const options: SuggestOptions = {
        minScore: 0.6,
        maxSuggestions: 3,
        normalize: true,
      };

      expect(options.minScore).toBe(0.6);
      expect(options.maxSuggestions).toBe(3);
      expect(options.normalize).toBe(true);
    });
  });

  describe('NormalizeOptions', () => {
    it('should allow all fields to be optional', () => {
      const options: NormalizeOptions = {};
      expect(options).toBeDefined();
    });

    it('should accept stripAccents flag', () => {
      const options: NormalizeOptions = { stripAccents: true };
      expect(options.stripAccents).toBe(true);
    });

    it('should accept locale setting', () => {
      const options: NormalizeOptions = { locale: 'tr' };
      expect(options.locale).toBe('tr');
    });

    it('should accept both fields together', () => {
      const options: NormalizeOptions = {
        stripAccents: true,
        locale: 'en',
      };

      expect(options.stripAccents).toBe(true);
      expect(options.locale).toBe('en');
    });
  });
});
