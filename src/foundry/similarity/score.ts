import { distance } from './distance.js';

/**
 * Calculate normalized similarity score between two strings.
 *
 * Returns a value between 0.0 (completely different) and 1.0 (identical).
 * Formula: 1 - distance / max(len(a), len(b))
 * Empty strings return 1.0 (considered identical).
 *
 * @module foundry/similarity/score
 */

export function score(a: string, b: string): number {
  const aLen = [...a].length;
  const bLen = [...b].length;
  const maxLen = Math.max(aLen, bLen);

  if (maxLen === 0) {
    return 1.0;
  }

  const dist = distance(a, b);
  return 1.0 - dist / maxLen;
}
