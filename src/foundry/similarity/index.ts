/**
 * Foundry similarity module - Text similarity and normalization utilities
 *
 * Implements the Crucible Foundry Text Similarity & Normalization Standard v2.0.0 (2025.10.3).
 *
 * @module foundry/similarity
 */

export const VERSION = '2.0.0';

export { distance } from './distance.js';
export { SimilarityError } from './errors.js';
export {
  casefold,
  equalsIgnoreCase,
  normalize,
  stripAccents,
} from './normalization.js';
export { score } from './score.js';
export { suggest } from './suggest.js';

export type {
  MetricType,
  NormalizeOptions,
  NormalizationPreset,
  Suggestion,
  SuggestOptions,
} from './types.js';
