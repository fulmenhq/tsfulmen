/**
 * Severity mappings for error handling
 *
 * Implements severity levels from assessment/v1.0.0/severity-definitions schema
 * Provides bidirectional mapping between severity names and numeric levels
 */

/**
 * Severity names aligned with assessment taxonomy
 */
export const Severity = {
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

/**
 * Severity name type (string literal union)
 */
export type SeverityName = (typeof Severity)[keyof typeof Severity];

/**
 * Numeric severity level for sorting and comparison
 * info=0, low=1, medium=2, high=3, critical=4
 */
export type SeverityLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Canonical severity level mapping (name → level)
 * Aligned with schemas/crucible-ts/assessment/v1.0.0/severity-definitions.schema.json
 */
export const SEVERITY_LEVELS: Record<SeverityName, SeverityLevel> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Reverse mapping (level → name)
 */
export const LEVEL_TO_SEVERITY: Record<SeverityLevel, SeverityName> = {
  0: 'info',
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'critical',
};

/**
 * Convert severity name to numeric level
 *
 * @param name - Severity name (info, low, medium, high, critical)
 * @returns Numeric severity level (0-4)
 * @throws {Error} If severity name is invalid
 *
 * @example
 * ```typescript
 * severityToLevel('high') // returns 3
 * severityToLevel('info') // returns 0
 * ```
 */
export function severityToLevel(name: string): SeverityLevel {
  if (!isSeverityName(name)) {
    throw new Error(
      `Invalid severity name: "${name}". Must be one of: ${Object.values(Severity).join(', ')}`,
    );
  }
  return SEVERITY_LEVELS[name];
}

/**
 * Convert numeric level to severity name
 *
 * @param level - Numeric severity level (0-4)
 * @returns Severity name
 * @throws {Error} If level is invalid
 *
 * @example
 * ```typescript
 * levelToSeverity(3) // returns 'high'
 * levelToSeverity(0) // returns 'info'
 * ```
 */
export function levelToSeverity(level: number): SeverityName {
  if (!isSeverityLevel(level)) {
    throw new Error(`Invalid severity level: ${level}. Must be 0-4`);
  }
  return LEVEL_TO_SEVERITY[level];
}

/**
 * Type guard to check if a value is a valid severity name
 *
 * @param value - Value to check
 * @returns True if value is a valid SeverityName
 *
 * @example
 * ```typescript
 * if (isSeverityName(value)) {
 *   const level = severityToLevel(value); // Type-safe
 * }
 * ```
 */
export function isSeverityName(value: unknown): value is SeverityName {
  return typeof value === 'string' && Object.values(Severity).includes(value as SeverityName);
}

/**
 * Type guard to check if a value is a valid severity level
 *
 * @param value - Value to check
 * @returns True if value is a valid SeverityLevel
 *
 * @example
 * ```typescript
 * if (isSeverityLevel(value)) {
 *   const name = levelToSeverity(value); // Type-safe
 * }
 * ```
 */
export function isSeverityLevel(value: unknown): value is SeverityLevel {
  return typeof value === 'number' && value >= 0 && value <= 4 && Number.isInteger(value);
}

/**
 * Get default severity (medium/2) when not specified
 *
 * @returns Default severity name and level
 */
export function getDefaultSeverity(): {
  name: SeverityName;
  level: SeverityLevel;
} {
  return {
    name: Severity.MEDIUM,
    level: 2,
  };
}

/**
 * Compare two severity levels
 *
 * @param a - First severity (name or level)
 * @param b - Second severity (name or level)
 * @returns Negative if a < b, positive if a > b, zero if equal
 *
 * @example
 * ```typescript
 * compareSeverity('high', 'low') // returns positive (high > low)
 * compareSeverity(2, 'critical') // returns negative (medium < critical)
 * ```
 */
export function compareSeverity(
  a: SeverityName | SeverityLevel,
  b: SeverityName | SeverityLevel,
): number {
  const levelA = typeof a === 'string' ? severityToLevel(a) : a;
  const levelB = typeof b === 'string' ? severityToLevel(b) : b;
  return levelA - levelB;
}
