/**
 * Correlation ID generation and validation for error tracking
 *
 * Provides UUID v4 generation for correlation IDs used in observability
 * and distributed tracing scenarios.
 */

import { randomUUID } from 'node:crypto';

/**
 * UUID v4 regex pattern for validation
 */
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generate a new correlation ID (UUID v4)
 *
 * Uses Node.js crypto.randomUUID() for cryptographically strong random values.
 *
 * @returns UUID v4 string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 *
 * @example
 * ```typescript
 * const correlationId = generateCorrelationId();
 * // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Validate if a string is a valid UUID v4 correlation ID
 *
 * Checks format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where y is one of [8, 9, a, b]
 *
 * @param id - String to validate
 * @returns True if valid UUID v4 format
 *
 * @example
 * ```typescript
 * isValidCorrelationId('550e8400-e29b-41d4-a716-446655440000') // true
 * isValidCorrelationId('not-a-uuid') // false
 * isValidCorrelationId('550e8400-e29b-31d4-a716-446655440000') // false (version 3, not 4)
 * ```
 */
export function isValidCorrelationId(id: string): boolean {
  return UUID_V4_PATTERN.test(id);
}

/**
 * Normalize a correlation ID (lowercase, trim whitespace)
 *
 * @param id - Correlation ID to normalize
 * @returns Normalized correlation ID
 *
 * @example
 * ```typescript
 * normalizeCorrelationId('  550E8400-E29B-41D4-A716-446655440000  ')
 * // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function normalizeCorrelationId(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * Type guard to check if a value is a valid correlation ID
 *
 * @param value - Value to check
 * @returns True if value is a string and valid UUID v4
 *
 * @example
 * ```typescript
 * if (isCorrelationId(value)) {
 *   // TypeScript knows value is string here
 *   const normalized = normalizeCorrelationId(value);
 * }
 * ```
 */
export function isCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && isValidCorrelationId(value);
}
