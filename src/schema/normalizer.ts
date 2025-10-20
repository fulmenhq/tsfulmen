/**
 * Schema normalizer - implements schema normalization per Fulmen standard
 *
 * Provides utilities for canonicalizing and comparing schemas across
 * JSON and YAML formats with comment preservation and deterministic output.
 */

import { parse as parseYAML } from 'yaml';
import { SchemaValidationError } from './errors.js';
import type { SchemaInput, SchemaNormalizationOptions } from './types.js';

/**
 * Parse schema input to object
 */
function parseSchemaInput(input: SchemaInput): Record<string, unknown> {
  if (!input) {
    throw SchemaValidationError.parseFailed(
      { type: 'string', content: '' },
      new Error('schema content is empty'),
    );
  }

  try {
    if (typeof input === 'string') {
      // Try JSON first, fall back to YAML
      try {
        return JSON.parse(input) as Record<string, unknown>;
      } catch {
        return parseYAML(input) as Record<string, unknown>;
      }
    }

    if (Buffer.isBuffer(input)) {
      const content = input.toString('utf-8');
      try {
        return JSON.parse(content) as Record<string, unknown>;
      } catch {
        return parseYAML(content) as Record<string, unknown>;
      }
    }

    // Already an object
    return input as Record<string, unknown>;
  } catch (error) {
    throw SchemaValidationError.parseFailed(
      {
        type: typeof input === 'string' ? 'string' : 'object',
        content: typeof input === 'string' ? input : JSON.stringify(input),
      },
      error as Error,
    );
  }
}

/**
 * Sort object keys recursively in lexicographical order
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }

  return sorted;
}

/**
 * Normalize schema to canonical JSON format
 *
 * Per Fulmen Schema Normalization Standard:
 * - Accepts YAML or JSON input
 * - Strips comments while preserving semantic structure
 * - Sorts keys lexicographically
 * - Produces deterministic, pretty-printed JSON (or compact if requested)
 */
export function normalizeSchema(
  input: SchemaInput,
  options: SchemaNormalizationOptions = {},
): string {
  try {
    // Parse input to object
    const parsed = parseSchemaInput(input);

    // Sort keys recursively
    const sorted = sortObjectKeys(parsed);

    // Serialize to JSON with optional compact mode
    if (options.compact) {
      return JSON.stringify(sorted);
    }

    // Default: pretty-printed with 2-space indentation
    return JSON.stringify(sorted, null, 2);
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      throw error;
    }
    throw SchemaValidationError.parseFailed(
      {
        type: typeof input === 'string' ? 'string' : 'object',
        content: typeof input === 'string' ? input : JSON.stringify(input),
      },
      error as Error,
    );
  }
}

/**
 * Compare two schemas for semantic equality
 *
 * Normalizes both schemas and compares the canonical JSON output.
 * Returns equality result along with normalized versions for debugging.
 */
export function compareSchemas(
  schemaA: SchemaInput,
  schemaB: SchemaInput,
  options: SchemaNormalizationOptions = {},
): { equal: boolean; normalizedA: string; normalizedB: string } {
  const normalizedA = normalizeSchema(schemaA, options);
  const normalizedB = normalizeSchema(schemaB, options);

  return {
    equal: normalizedA === normalizedB,
    normalizedA,
    normalizedB,
  };
}
