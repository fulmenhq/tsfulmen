/**
 * Distance calculation with multiple metric support.
 *
 * Implements Crucible Foundry Similarity Standard v2.0.0 with WASM-backed metrics.
 *
 * @module foundry/similarity/distance
 */

import {
  damerau_levenshtein,
  jaro_winkler,
  levenshtein,
  osa_distance,
  substringSimilarity,
} from "@3leaps/string-metrics-wasm";
import type { MetricType } from "./types.js";

/**
 * Calculate edit distance between two strings using specified metric.
 *
 * @param a - First string
 * @param b - Second string
 * @param metric - Distance metric (default: "levenshtein")
 * @returns Edit distance as non-negative integer (or similarity score for jaro_winkler/substring)
 *
 * @example
 * distance("kitten", "sitting") // 3
 * distance("abcd", "abdc", "damerau_osa") // 1
 * distance("CA", "ABC", "damerau_unrestricted") // 2
 * distance("hello world", "world", "substring") // 0.625 (as score, not distance)
 */
export function distance(a: string, b: string, metric: MetricType = "levenshtein"): number {
  switch (metric) {
    case "levenshtein":
      return levenshtein(a, b);
    case "damerau_osa":
      return osa_distance(a, b);
    case "damerau_unrestricted":
      return damerau_levenshtein(a, b);
    case "jaro_winkler":
      return jaro_winkler(a, b);
    case "substring":
      // Returns similarity score (not distance) with longest common substring
      return substringSimilarity(a, b).score;
    default:
      throw new Error(
        `Invalid metric '${metric}': must be one of: levenshtein, damerau_osa, damerau_unrestricted, jaro_winkler, substring`,
      );
  }
}
