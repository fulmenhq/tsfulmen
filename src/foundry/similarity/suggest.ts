import { normalize } from './normalization.js';
import { score } from './score.js';
import type { Suggestion, SuggestOptions } from './types.js';

const DEFAULT_MIN_SCORE = 0.6;
const DEFAULT_MAX_SUGGESTIONS = 3;
const DEFAULT_NORMALIZE = true;

export function suggest(
  input: string,
  candidates: readonly string[],
  options?: SuggestOptions,
): Suggestion[] {
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
  const maxSuggestions = options?.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS;
  const shouldNormalize = options?.normalize ?? DEFAULT_NORMALIZE;

  const normalizedInput = shouldNormalize ? normalize(input) : input;

  const scored: Suggestion[] = [];

  for (const candidate of candidates) {
    const normalizedCandidate = shouldNormalize ? normalize(candidate) : candidate;
    const similarity = score(normalizedInput, normalizedCandidate);

    if (similarity >= minScore) {
      scored.push({
        value: candidate,
        score: similarity,
      });
    }
  }

  scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.0001) {
      return a.value.localeCompare(b.value);
    }
    return b.score - a.score;
  });

  return scored.slice(0, maxSuggestions);
}
