/**
 * Normalized similarity score with metric selection.
 *
 * Implements Crucible Foundry Similarity Standard v2.0.0.
 *
 * @module foundry/similarity/score
 */

import {
  type SimilarityMetric,
  substringSimilarity,
  score as wasmScore,
} from '@3leaps/string-metrics-wasm';
import type { MetricType } from './types.js';

/**
 * Calculate normalized similarity score between two strings.
 *
 * Returns a value between 0.0 (completely different) and 1.0 (identical).
 * For distance-based metrics: 1 - distance / max(len(a), len(b))
 * For jaro_winkler and substring: direct similarity score
 *
 * @param a - First string
 * @param b - Second string
 * @param metric - Similarity metric (default: "levenshtein")
 * @returns Similarity score in range [0.0, 1.0]
 *
 * @example
 * score("kitten", "sitting") // 0.5714...
 * score("hello", "hallo", "jaro_winkler") // 0.88
 * score("hello world", "world", "substring") // 0.625
 */
export function score(a: string, b: string, metric: MetricType = 'levenshtein'): number {
  // Special case: substring uses different API to get proper longest common substring
  if (metric === 'substring') {
    return substringSimilarity(a, b).score;
  }

  // All other metrics supported directly by WASM score function
  return wasmScore(a, b, metric as SimilarityMetric);
}
