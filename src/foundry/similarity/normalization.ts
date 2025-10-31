/**
 * Unicode-aware text normalization utilities.
 *
 * Implements Crucible Foundry Similarity Standard v2.0.0 with normalization presets.
 *
 * @module foundry/similarity/normalization
 */

import { normalize as wasmNormalize } from '@3leaps/string-metrics-wasm';
import type { NormalizeOptions, NormalizationPreset } from './types.js';

/**
 * Apply normalization preset to text.
 *
 * @param value - Text to normalize
 * @param preset - Normalization preset ("none" | "minimal" | "default" | "aggressive")
 * @returns Normalized text
 *
 * @example
 * normalize("  Café-Zürich!  ", "aggressive") // "cafezurich"
 * normalize("  Hello  ", "minimal") // "Hello"
 */
export function normalize(
  value: string,
  preset: NormalizationPreset | NormalizeOptions = 'default',
): string {
  // Handle legacy NormalizeOptions interface for backward compatibility
  if (typeof preset === 'object') {
    // Map old options to preset
    if (preset.stripAccents) {
      return wasmNormalize(value, 'aggressive');
    }
    return wasmNormalize(value, 'default');
  }

  return wasmNormalize(value, preset);
}

/**
 * Unicode-aware case folding.
 *
 * @param value - Text to casefold
 * @param locale - Optional locale (e.g., "tr" for Turkish)
 * @returns Lowercase text
 */
export function casefold(value: string, locale?: string): string {
  if (locale === 'tr') {
    return value.toLocaleLowerCase('tr-TR');
  }
  return value.toLowerCase();
}

/**
 * Strip diacritical marks from text.
 *
 * @param value - Text to process
 * @returns Text with accents removed
 */
export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Compare strings ignoring case and optionally accents.
 *
 * @param a - First string
 * @param b - Second string
 * @param options - Normalization options
 * @returns True if strings are equal after normalization
 */
export function equalsIgnoreCase(a: string, b: string, options?: NormalizeOptions): boolean {
  return normalize(a, options) === normalize(b, options);
}
