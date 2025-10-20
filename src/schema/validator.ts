/**
 * Schema validator - implements AJV-based schema validation with goneat integration
 */

import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYAML } from 'yaml';
import { SchemaValidationError } from './errors.js';
import type { CompiledValidator, SchemaInput, SchemaValidationResult } from './types.js';
import { createDiagnostic } from './utils.js';

/**
 * AJV instance with draft 2020-12 support and custom formats
 */
let ajvInstance: Ajv | undefined;

/**
 * Schema cache for compiled validators
 */
const schemaCache = new Map<string, CompiledValidator>();

/**
 * Get or create AJV instance
 */
function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
    });

    // Add custom formats
    addFormats(ajvInstance, {
      mode: 'fast',
      formats: ['date-time', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uri-reference'],
    });
  }

  return ajvInstance;
}

/**
 * Compile a schema for validation
 */
export async function compileSchema(schema: SchemaInput): Promise<CompiledValidator> {
  // Create cache key from schema content
  const cacheKey = typeof schema === 'string' ? schema : JSON.stringify(schema);

  // Check cache first
  const cached = schemaCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const ajv = getAjv();

  let parsedSchema: unknown;
  if (typeof schema === 'string') {
    try {
      parsedSchema = JSON.parse(schema);
    } catch {
      // Try YAML if JSON parsing fails
      parsedSchema = parseYAML(schema);
    }
  } else if (Buffer.isBuffer(schema)) {
    const content = schema.toString('utf-8');
    try {
      parsedSchema = JSON.parse(content);
    } catch {
      parsedSchema = parseYAML(content);
    }
  } else {
    parsedSchema = schema;
  }

  try {
    const validator = ajv.compile(parsedSchema as Record<string, unknown>);

    // Cache the compiled validator
    schemaCache.set(cacheKey, validator as CompiledValidator);

    return validator as CompiledValidator;
  } catch (error) {
    throw SchemaValidationError.parseFailed(
      {
        type: 'string',
        content: typeof schema === 'string' ? schema : JSON.stringify(schema),
      },
      error as Error,
    );
  }
}

/**
 * Validate data against a compiled schema
 */
export function validateData(data: unknown, validator: CompiledValidator): SchemaValidationResult {
  const valid = validator(data);

  const result: SchemaValidationResult = {
    valid,
    diagnostics: [],
    source: 'ajv',
  };

  if (!valid && validator.errors) {
    const errors = validator.errors;
    if (Array.isArray(errors)) {
      result.diagnostics = errors.map((error) =>
        createDiagnostic(
          error.instancePath || '',
          error.message || 'Validation failed',
          error.keyword || 'unknown',
          'ERROR',
          'ajv',
        ),
      );
    }
  }

  return result;
}

/**
 * Validate file against a schema
 */
export async function validateFile(
  filePath: string,
  validator: CompiledValidator,
): Promise<SchemaValidationResult> {
  try {
    const content = await readFile(filePath, 'utf-8');
    let data: unknown;

    try {
      data = JSON.parse(content);
    } catch {
      // Try YAML if JSON parsing fails
      data = parseYAML(content);
    }

    return validateData(data, validator);
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      throw error;
    }
    throw SchemaValidationError.validationFailed(
      filePath,
      [
        createDiagnostic(
          '',
          `Failed to read or parse file: ${(error as Error).message}`,
          'file-read',
          'ERROR',
          'ajv',
        ),
      ],
      { type: 'file', id: filePath },
    );
  }
}

/**
 * Validate a schema document itself
 */
export async function validateSchema(schema: SchemaInput): Promise<SchemaValidationResult> {
  try {
    const validator = await compileSchema(schema);

    // Test the schema with an empty object to ensure it compiles
    validateData({}, validator);

    return {
      valid: true,
      diagnostics: [],
      source: 'ajv',
    };
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return {
        valid: false,
        diagnostics: error.diagnostics,
        source: 'ajv',
      };
    }

    return {
      valid: false,
      diagnostics: [
        createDiagnostic(
          '',
          `Schema validation failed: ${(error as Error).message}`,
          'schema-validation',
          'ERROR',
          'ajv',
        ),
      ],
      source: 'ajv',
    };
  }
}

/**
 * Clear schema cache
 */
export function clearCache(): void {
  schemaCache.clear();
}

/**
 * Get schema cache size
 */
export function getCacheSize(): number {
  return schemaCache.size;
}
