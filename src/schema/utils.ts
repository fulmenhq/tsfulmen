/**
 * Schema validation utilities - helper functions for formatting and validation
 */

import { SchemaValidationError } from './errors.js';
import type { SchemaValidationDiagnostic, SchemaValidationResult } from './types.js';

/**
 * Format validation diagnostics for display
 */
export function formatDiagnostics(diagnostics: SchemaValidationDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return 'No validation issues found.';
  }

  const lines: string[] = [];
  const errors = diagnostics.filter((d) => d.severity === 'ERROR');
  const warnings = diagnostics.filter((d) => d.severity === 'WARN');

  if (errors.length > 0) {
    lines.push(`❌ ${errors.length} error(s) found:`);
    errors.forEach((diag, index) => {
      lines.push(`  ${index + 1}. ${diag.message}`);
      if (diag.pointer) {
        lines.push(`     at ${diag.pointer}`);
      }
      if (diag.keyword) {
        lines.push(`     keyword: ${diag.keyword}`);
      }
    });
  }

  if (warnings.length > 0) {
    lines.push('');
    lines.push(`⚠️  ${warnings.length} warning(s) found:`);
    warnings.forEach((diag, index) => {
      lines.push(`  ${index + 1}. ${diag.message}`);
      if (diag.pointer) {
        lines.push(`     at ${diag.pointer}`);
      }
    });
  }

  return lines.join('\n');
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: SchemaValidationResult): string {
  if (result.valid) {
    return '✅ Validation passed';
  }

  const output: string[] = [];
  output.push('❌ Validation failed');
  output.push(formatDiagnostics(result.diagnostics));
  output.push(`\nSource: ${result.source}`);

  return output.join('\n');
}

/**
 * Check if value is a SchemaValidationError
 */
export function isValidationError(error: unknown): error is SchemaValidationError {
  return error instanceof SchemaValidationError;
}

/**
 * Extract validation result from error or return success
 */
export function extractValidationResult(error: unknown): {
  valid: boolean;
  diagnostics: SchemaValidationDiagnostic[];
  source: 'ajv' | 'goneat';
} {
  if (isValidationError(error)) {
    return {
      valid: false,
      diagnostics: error.diagnostics,
      source: error.diagnostics[0]?.source || 'ajv',
    };
  }

  return {
    valid: true,
    diagnostics: [],
    source: 'ajv',
  };
}

/**
 * Normalize JSON pointer path for display
 */
export function normalizePointer(pointer: string): string {
  if (pointer === '') {
    return 'root';
  }
  return pointer.replace(/^\//, '').replace(/\//g, '.');
}

/**
 * Create a validation diagnostic
 */
export function createDiagnostic(
  pointer: string,
  message: string,
  keyword: string,
  severity: 'ERROR' | 'WARN' = 'ERROR',
  source: 'ajv' | 'goneat' = 'ajv',
  data?: unknown,
): SchemaValidationDiagnostic {
  return {
    pointer,
    message,
    keyword,
    severity,
    source,
    data,
  };
}

/**
 * Group diagnostics by severity
 */
export function groupDiagnosticsBySeverity(diagnostics: SchemaValidationDiagnostic[]): {
  errors: SchemaValidationDiagnostic[];
  warnings: SchemaValidationDiagnostic[];
} {
  return {
    errors: diagnostics.filter((d) => d.severity === 'ERROR'),
    warnings: diagnostics.filter((d) => d.severity === 'WARN'),
  };
}

/**
 * Count diagnostics by severity
 */
export function countDiagnostics(diagnostics: SchemaValidationDiagnostic[]): {
  total: number;
  errors: number;
  warnings: number;
} {
  const grouped = groupDiagnosticsBySeverity(diagnostics);
  return {
    total: diagnostics.length,
    errors: grouped.errors.length,
    warnings: grouped.warnings.length,
  };
}
