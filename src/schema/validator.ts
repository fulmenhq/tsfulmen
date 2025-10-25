/**
 * Schema validator - implements AJV-based schema validation with goneat integration
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYAML } from 'yaml';
import { metrics } from '../telemetry/index.js';
import { SchemaValidationError } from './errors.js';
import { getSchemaRegistry } from './registry.js';
import type {
  CompiledValidator,
  SchemaInput,
  SchemaRegistryOptions,
  SchemaValidationResult,
} from './types.js';
import { createDiagnostic } from './utils.js';

/**
 * AJV instance with draft 2020-12 support and custom formats
 */
let ajvInstance: Ajv | undefined;

/**
 * Metaschema initialization promise
 */
let metaschemaReady: Promise<void> | null = null;

/**
 * Schema cache for compiled validators
 */
const schemaCache = new Map<string, CompiledValidator>();

/**
 * Load metaschema from Crucible SSOT
 */
async function loadMetaSchema(
  draft: 'draft-07' | 'draft-2020-12',
): Promise<Record<string, unknown>> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const metaSchemaPath = join(
    __dirname,
    '..',
    '..',
    'schemas',
    'crucible-ts',
    'meta',
    draft,
    'schema.json',
  );

  const content = await readFile(metaSchemaPath, 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
}

/**
 * Load draft 2020-12 vocabulary schemas
 */
async function loadVocabularySchemas(): Promise<Record<string, unknown>[]> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const vocabDir = join(
    __dirname,
    '..',
    '..',
    'schemas',
    'crucible-ts',
    'meta',
    'draft-2020-12',
    'meta',
  );

  const vocabFiles = [
    'core.json',
    'applicator.json',
    'unevaluated.json',
    'validation.json',
    'meta-data.json',
    'format-annotation.json',
    'content.json',
  ];

  const schemas: Record<string, unknown>[] = [];
  for (const file of vocabFiles) {
    try {
      const content = await readFile(join(vocabDir, file), 'utf-8');
      schemas.push(JSON.parse(content) as Record<string, unknown>);
    } catch {
      // Vocabulary schema not found, skip
    }
  }

  return schemas;
}

/**
 * Load referenced schemas (including YAML files) for AJV
 *
 * Resolves relative paths from schemas/ and config/ directories.
 * Handles both relative paths and https://schemas.fulmenhq.dev URIs.
 */
async function loadReferencedSchema(uri: string): Promise<Record<string, unknown>> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const repoRoot = join(__dirname, '..', '..');

  let resolvedPath: string;

  // Handle https://schemas.fulmenhq.dev/ URIs - map to local files
  if (uri.startsWith('https://schemas.fulmenhq.dev/')) {
    const relativePath = uri.replace('https://schemas.fulmenhq.dev/', '');

    // Check if it's a config taxonomy reference
    if (relativePath.startsWith('config/taxonomy/')) {
      resolvedPath = join(
        repoRoot,
        'config',
        'crucible-ts',
        'taxonomy',
        relativePath.split('/').pop() || '',
      );
    } else {
      // Schema reference - map to schemas/crucible-ts/
      resolvedPath = join(repoRoot, 'schemas', 'crucible-ts', relativePath);
    }
  }
  // Handle relative paths (e.g., "../../../../config/taxonomy/metrics.yaml")
  else if (uri.startsWith('../../') || uri.startsWith('../')) {
    // Resolve relative to schemas/crucible-ts/observability/metrics/v1.0.0/
    // (where metrics-event.schema.json is located)
    const schemaBase = join(
      repoRoot,
      'schemas',
      'crucible-ts',
      'observability',
      'metrics',
      'v1.0.0',
    );
    resolvedPath = join(schemaBase, uri);
  }
  // Handle file:// URIs
  else if (uri.startsWith('file://')) {
    resolvedPath = fileURLToPath(uri);
  }
  // Unhandled URI scheme
  else {
    throw new Error(`Cannot load remote schema: ${uri}`);
  }

  // Read and parse the file
  const content = await readFile(resolvedPath, 'utf-8');
  const ext = resolvedPath.split('.').pop()?.toLowerCase();

  if (ext === 'yaml' || ext === 'yml') {
    return parseYAML(content) as Record<string, unknown>;
  }
  return JSON.parse(content) as Record<string, unknown>;
}

/**
 * Get or create AJV instance with draft 2020-12 support
 */
function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
      // Allow schemas with $id to be added without replacing existing ones
      addUsedSchema: false,
      // Enable async schema loading for YAML references
      loadSchema: loadReferencedSchema,
    });

    // Add custom formats
    addFormats(ajvInstance, {
      mode: 'fast',
      formats: ['date-time', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uri-reference'],
    });

    // Initialize metaschema loading
    metaschemaReady = Promise.all([loadVocabularySchemas(), loadMetaSchema('draft-2020-12')])
      .then(([vocabSchemas, metaSchema]) => {
        if (ajvInstance) {
          // Add vocabulary schemas first (they are referenced by metaschema)
          for (const vocabSchema of vocabSchemas) {
            try {
              ajvInstance.addMetaSchema(vocabSchema);
            } catch {
              // Vocabulary already added or has issues, continue
            }
          }

          // Then add draft 2020-12 metaschema
          ajvInstance.addMetaSchema(metaSchema);
        }
      })
      .catch((error) => {
        throw new Error(`Failed to load metaschemas: ${error}`);
      });
  }

  return ajvInstance;
}

/**
 * Compile a schema for validation
 */
export async function compileSchema(
  schema: SchemaInput,
  options: { aliases?: string[] } = {},
): Promise<CompiledValidator> {
  // Ensure metaschemas are loaded before compiling
  const ajv = getAjv();
  if (metaschemaReady) {
    await metaschemaReady;
  }

  // Create cache key from schema content
  const cacheKey = typeof schema === 'string' ? schema : JSON.stringify(schema);

  // Check cache first
  const cached = schemaCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

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
    // Register schema aliases (e.g., alternate $id values) before compile to support relative refs
    if (options.aliases && options.aliases.length > 0) {
      for (const alias of options.aliases) {
        if (alias && ajv.getSchema(alias) === undefined) {
          try {
            ajv.addSchema(parsedSchema as Record<string, unknown>, alias);
          } catch {
            // Ignore if alias already registered or invalid
          }
        }
      }
    }

    // Use compileAsync to support loading external references (e.g., YAML files)
    const validator = await ajv.compileAsync(parsedSchema as Record<string, unknown>);

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
    metrics.counter('schema_validation_errors').inc();
  } else {
    metrics.counter('schema_validations').inc();
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

/**
 * Load schema by ID from registry and compile
 */
export async function compileSchemaById(
  schemaId: string,
  registryOptions?: SchemaRegistryOptions,
): Promise<CompiledValidator> {
  try {
    const registry = getSchemaRegistry(registryOptions);
    const metadata = await registry.getSchema(schemaId);

    const content = await readFile(metadata.path, 'utf-8');
    const aliases: string[] = [];

    const normalizedRelativePath = metadata.relativePath.replace(/\\/g, '/');
    if (normalizedRelativePath) {
      aliases.push(new URL(normalizedRelativePath, 'https://schemas.fulmenhq.dev/').toString());
    }

    return compileSchema(content, { aliases });
  } catch (error) {
    metrics.counter('schema_validation_errors').inc();
    throw error;
  }
}

/**
 * Validate data against a schema ID from registry
 */
export async function validateDataBySchemaId(
  data: unknown,
  schemaId: string,
  registryOptions?: SchemaRegistryOptions,
): Promise<SchemaValidationResult> {
  try {
    const validator = await compileSchemaById(schemaId, registryOptions);
    return validateData(data, validator);
  } catch (error) {
    metrics.counter('schema_validation_errors').inc();
    throw error;
  }
}

/**
 * Validate file against a schema ID from registry
 */
export async function validateFileBySchemaId(
  filePath: string,
  schemaId: string,
  registryOptions?: SchemaRegistryOptions,
): Promise<SchemaValidationResult> {
  try {
    const validator = await compileSchemaById(schemaId, registryOptions);
    return validateFile(filePath, validator);
  } catch (error) {
    metrics.counter('schema_validation_errors').inc();
    throw error;
  }
}
