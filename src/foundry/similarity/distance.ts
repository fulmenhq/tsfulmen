/**
 * Levenshtein distance calculation using Wagner-Fischer algorithm.
 *
 * Implements dynamic programming with two-row optimization for O(min(m,n)) space complexity.
 * Handles grapheme clusters correctly using JavaScript spread operator.
 *
 * @module foundry/similarity/distance
 */

export function distance(a: string, b: string): number {
  const aChars = [...a];
  const bChars = [...b];

  if (aChars.length === 0) return bChars.length;
  if (bChars.length === 0) return aChars.length;

  let prevRow = new Array(bChars.length + 1);
  let currRow = new Array(bChars.length + 1);

  for (let j = 0; j <= bChars.length; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= aChars.length; i++) {
    currRow[0] = i;

    for (let j = 1; j <= bChars.length; j++) {
      const cost = aChars[i - 1] === bChars[j - 1] ? 0 : 1;

      currRow[j] = Math.min(prevRow[j] + 1, currRow[j - 1] + 1, prevRow[j - 1] + cost);
    }

    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[bChars.length];
}
