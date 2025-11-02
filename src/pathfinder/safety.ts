/**
 * Path safety and constraint enforcement utilities
 */

import path from 'node:path';

import { createPathfinderError, PathfinderErrorCode } from './errors.js';
import type { PathConstraint } from './types.js';

/**
 * Result of evaluating a path against configured constraints.
 */
export interface ConstraintEvaluation {
  /** Whether the path satisfied all constraints */
  allowed: boolean;
  /** Optional reason describing the violation */
  reason?: string;
}

/**
 * Normalize a path for comparison by resolving against root.
 */
function normalizeAbsolute(p: string): string {
  return path.resolve(p);
}

/**
 * Convert filesystem-relative paths to POSIX form for glob evaluation.
 */
export function toPosixPath(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Determine if candidate path is contained within the provided root directory.
 *
 * @param candidate - Absolute path to check
 * @param root - Root directory that bounds traversal
 */
export function isPathWithinRoot(candidate: string, root: string): boolean {
  const normalizedCandidate = normalizeAbsolute(candidate);
  const normalizedRoot = normalizeAbsolute(root);
  const relative = path.relative(normalizedRoot, normalizedCandidate);

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Evaluate a path against a configured constraint definition.
 *
 * Does not throw directly; callers should inspect {@link ConstraintEvaluation.allowed}
 * and escalate according to enforcement level.
 *
 * @param absolutePath - Absolute path being evaluated
 * @param relativePath - Path relative to discovery root (POSIX or platform-specific)
 * @param constraint - Constraint configuration (may be undefined)
 */
export function enforcePathConstraints(
  absolutePath: string,
  _relativePath: string,
  constraint?: PathConstraint,
): ConstraintEvaluation {
  if (!constraint) {
    return { allowed: true };
  }

  const constraintRoot = constraint.root ? normalizeAbsolute(constraint.root) : undefined;

  if (!constraintRoot) {
    return { allowed: true };
  }

  const normalizedConstraintRoot = constraintRoot;
  const normalizedAbsolutePath = normalizeAbsolute(absolutePath);

  if (!isPathWithinRoot(normalizedAbsolutePath, normalizedConstraintRoot)) {
    return {
      allowed: false,
      reason: `Path ${normalizedAbsolutePath} escapes constraint root ${normalizedConstraintRoot}`,
    };
  }

  return { allowed: true };
}

/**
 * Create a constraint violation error for STRICT enforcement modes.
 *
 * @param reason - Human-readable violation reason
 * @param context - Additional error context
 */
export function createConstraintViolationError(
  reason: string,
  context?: Record<string, unknown>,
): Error {
  return createPathfinderError(PathfinderErrorCode.CONSTRAINT_VIOLATION, reason, {
    severity: 'critical',
    context,
  });
}
