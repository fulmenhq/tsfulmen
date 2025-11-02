/**
 * Suggestion API with fuzzy matching and configurable metrics.
 *
 * Implements Crucible Foundry Similarity Standard v2.0.0.
 *
 * @module foundry/similarity/suggest
 */

import { type SuggestMetric, suggest as wasmSuggest } from '@3leaps/string-metrics-wasm';
import type { Suggestion, SuggestOptions } from './types.js';

const DEFAULT_MIN_SCORE = 0.6;
const DEFAULT_MAX_SUGGESTIONS = 3;
const DEFAULT_METRIC = 'levenshtein';
const DEFAULT_NORMALIZE_PRESET = 'default';

/**
 * Generate ranked suggestions from candidate list based on similarity.
 *
 * @param input - Input string to match against
 * @param candidates - List of candidate strings
 * @param options - Suggestion options (metric, thresholds, normalization)
 * @returns Array of suggestions sorted by score (descending)
 *
 * @example
 * suggest("docscrib", ["docscribe", "crucible"], { metric: "levenshtein" })
 * // [{ value: "docscribe", score: 0.889, ... }]
 */
export function suggest(
  input: string,
  candidates: readonly string[],
  options?: SuggestOptions,
): Suggestion[] {
  const metric = options?.metric ?? DEFAULT_METRIC;
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
  const maxSuggestions = options?.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS;

  // Handle legacy 'normalize' boolean option
  let normalizePreset = options?.normalizePreset ?? DEFAULT_NORMALIZE_PRESET;
  if (options?.normalize === false) {
    normalizePreset = 'none';
  } else if (options?.normalize === true && !options?.normalizePreset) {
    normalizePreset = 'default';
  }

  // Pass metric name directly to WASM library (it handles "substring" correctly)
  const wasmOptions = {
    metric: metric as SuggestMetric,
    normalizePreset,
    minScore,
    maxSuggestions,
    preferPrefix: options?.preferPrefix,
    jaroPrefixScale: options?.jaroPrefixScale,
    jaroMaxPrefix: options?.jaroMaxPrefix,
  };

  const results = wasmSuggest(input, candidates as string[], wasmOptions);

  // Map WASM results to our Suggestion interface
  return results.map((r) => ({
    value: r.value,
    score: r.score,
    matchedRange: r.matchedRange as [number, number] | undefined,
    reason: r.reason,
    normalizedValue: r.normalizedValue,
  }));
}
