import type { NormalizeOptions } from './types.js';

/**
 * Unicode-aware text normalization utilities.
 *
 * Provides case folding, accent stripping, and whitespace handling
 * following the Crucible Foundry Similarity Standard (2025.10.2).
 *
 * @module foundry/similarity/normalization
 */

export function casefold(value: string, locale?: string): string {
  if (locale === 'tr') {
    return value.toLocaleLowerCase('tr-TR');
  }
  return value.toLowerCase();
}

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalize(value: string, options?: NormalizeOptions): string {
  let result = value.trim();

  result = casefold(result, options?.locale);

  if (options?.stripAccents) {
    result = stripAccents(result);
  }

  return result;
}

export function equalsIgnoreCase(a: string, b: string, options?: NormalizeOptions): boolean {
  return normalize(a, options) === normalize(b, options);
}
