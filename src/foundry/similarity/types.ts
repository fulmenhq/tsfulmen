/**
 * Type definitions for text similarity and normalization utilities.
 *
 * Implements types from Crucible Foundry Similarity Standard v2.0.0 (2025.10.3).
 *
 * @module foundry/similarity/types
 */

export type MetricType =
  | 'levenshtein'
  | 'damerau_osa'
  | 'damerau_unrestricted'
  | 'jaro_winkler'
  | 'substring';

export type NormalizationPreset = 'none' | 'minimal' | 'default' | 'aggressive';

export interface Suggestion {
  value: string;
  score: number;
  matchedRange?: [number, number];
  reason?: string;
  normalizedValue?: string;
}

export interface SuggestOptions {
  minScore?: number;
  maxSuggestions?: number;
  metric?: MetricType;
  normalizePreset?: NormalizationPreset;
  preferPrefix?: boolean;
  jaroPrefixScale?: number;
  jaroMaxPrefix?: number;
  /** @deprecated Use normalizePreset instead */
  normalize?: boolean;
}

export interface NormalizeOptions {
  stripAccents?: boolean;
  locale?: string;
}
