/**
 * Type definitions for text similarity and normalization utilities.
 *
 * Implements types from Crucible Foundry Similarity Standard (2025.10.2).
 *
 * @module foundry/similarity/types
 */

export interface Suggestion {
  value: string;
  score: number;
}

export interface SuggestOptions {
  minScore?: number;
  maxSuggestions?: number;
  normalize?: boolean;
}

export interface NormalizeOptions {
  stripAccents?: boolean;
  locale?: string;
}
