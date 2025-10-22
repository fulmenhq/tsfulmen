/**
 * Foundry similarity module - Text similarity and normalization utilities
 *
 * Implements the Crucible Foundry Text Similarity & Normalization Standard (2025.10.2).
 *
 * @module foundry/similarity
 */

export const VERSION = '1.0.0';

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

export type { NormalizeOptions, Suggestion, SuggestOptions } from './types.js';
