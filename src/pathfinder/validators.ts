/**
 * Pathfinder validators - Schema validation using TSFulmen schema module
 *
 * Uses the existing schema module instead of creating standalone AJV instances.
 * This ensures:
 * - Telemetry automatically emitted (schema_validations, schema_validation_errors)
 * - Schemas auto-discovered from Crucible SSOT
 * - Consistent error handling with other modules
 * - Validator caching handled automatically
 */

import { compileSchemaById, validateDataBySchemaId } from "../schema/index.js";
import type { CompiledValidator, SchemaValidationResult } from "../schema/types.js";
import { createPathfinderError, PathfinderErrorCode } from "./errors.js";

/**
 * Compile pathfinder config schema for validation
 *
 * Uses TSFulmen's schema registry to load from Crucible SSOT.
 * Schemas are cached automatically by the schema module.
 *
 * @returns Compiled validator for pathfinder configuration
 *
 * @example
 * ```typescript
 * const validator = await compileConfigSchema();
 * const result = validateData(config, validator);
 * ```
 */
export async function compileConfigSchema(): Promise<CompiledValidator> {
  return compileSchemaById("pathfinder/v1.0.0/finder-config");
}

/**
 * Compile path result schema for validation
 *
 * @returns Compiled validator for path results
 */
export async function compilePathResultSchema(): Promise<CompiledValidator> {
  return compileSchemaById("pathfinder/v1.0.0/path-result");
}

/**
 * Validate pathfinder configuration against Crucible schema
 *
 * Uses schema module which automatically emits telemetry:
 * - `schema_validations` counter on success
 * - `schema_validation_errors` counter on failure
 *
 * @param config - Configuration to validate
 * @returns Validation result with diagnostics
 *
 * @example
 * ```typescript
 * const result = await validateConfig({ root: '/tmp' });
 * if (!result.valid) {
 *   console.error('Invalid config:', result.diagnostics);
 * }
 * ```
 */
export async function validateConfig(config: unknown): Promise<SchemaValidationResult> {
  return validateDataBySchemaId(config, "pathfinder/v1.0.0/finder-config");
}

/**
 * Validate path result against Crucible schema
 *
 * @param result - Path result to validate
 * @returns Validation result with diagnostics
 *
 * @example
 * ```typescript
 * const result = await validatePathResult({
 *   relativePath: 'src/index.ts',
 *   sourcePath: '/tmp/src/index.ts',
 *   loaderType: 'local',
 *   metadata: { size: 1234, modified: '2025-11-01T12:00:00Z' }
 * });
 * ```
 */
export async function validatePathResult(result: unknown): Promise<SchemaValidationResult> {
  return validateDataBySchemaId(result, "pathfinder/v1.0.0/path-result");
}

/**
 * Validate config and throw on failure
 *
 * Convenience wrapper that throws FulmenError on validation failure.
 *
 * @param config - Configuration to validate
 * @throws {FulmenError} With pathfinder.validation_failed code
 *
 * @example
 * ```typescript
 * try {
 *   await assertValidConfig(config);
 *   // Config is valid, proceed
 * } catch (error) {
 *   // Handle validation error
 * }
 * ```
 */
export async function assertValidConfig(config: unknown): Promise<void> {
  const result = await validateConfig(config);

  if (!result.valid) {
    const messages = result.diagnostics.map((d) => d.message).join(", ");
    throw createPathfinderError(
      PathfinderErrorCode.VALIDATION_FAILED,
      `Invalid pathfinder configuration: ${messages}`,
      {
        severity: "high",
        context: { diagnostics: result.diagnostics },
      },
    );
  }
}

/**
 * Validate path result and throw on failure
 *
 * @param result - Path result to validate
 * @throws {FulmenError} With pathfinder.validation_failed code
 *
 * @example
 * ```typescript
 * await assertValidPathResult(result);
 * ```
 */
export async function assertValidPathResult(result: unknown): Promise<void> {
  const validationResult = await validatePathResult(result);

  if (!validationResult.valid) {
    const messages = validationResult.diagnostics.map((d) => d.message).join(", ");
    throw createPathfinderError(
      PathfinderErrorCode.VALIDATION_FAILED,
      `Invalid path result: ${messages}`,
      {
        severity: "high",
        context: { diagnostics: validationResult.diagnostics },
      },
    );
  }
}
