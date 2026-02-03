/**
 * Schema validator - implements AJV-based schema validation with goneat integration
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnySchema } from "ajv";
import Ajv from "ajv";
import Ajv2019 from "ajv/dist/2019.js";
import Ajv2020 from "ajv/dist/2020.js";
import AjvDraft04 from "ajv-draft-04";
import { parse as parseYAML } from "yaml";
import { metrics } from "../telemetry/index.js";
import { applyFulmenAjvFormats } from "./ajv-formats.js";
import { SchemaValidationError } from "./errors.js";
import { getSchemaRegistry } from "./registry.js";
import type {
  CompiledValidator,
  SchemaInput,
  SchemaRegistryOptions,
  SchemaValidationResult,
} from "./types.js";
import { createDiagnostic } from "./utils.js";

/**
 * Supported JSON Schema dialects for meta validation + compilation.
 */
type JsonSchemaDialect = "draft-04" | "draft-06" | "draft-07" | "draft-2019-09" | "draft-2020-12";

/**
 * AJV instances by dialect
 */
const ajvInstances = new Map<JsonSchemaDialect, Ajv>();

/**
 * Metaschema initialization promises by dialect
 */
const metaschemaReady = new Map<JsonSchemaDialect, Promise<void>>();

/**
 * Schema cache for compiled validators
 */
const schemaCache = new Map<string, CompiledValidator>();

/**
 * Load metaschema from Crucible SSOT
 */
async function loadMetaSchema(draft: JsonSchemaDialect): Promise<Record<string, unknown>> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const metaSchemaPath = join(
    __dirname,
    "..",
    "..",
    "schemas",
    "crucible-ts",
    "meta",
    draft,
    "schema.json",
  );

  const content = await readFile(metaSchemaPath, "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

/**
 * Load vocabulary schemas (draft 2019-09 / 2020-12)
 */
async function loadVocabularySchemas(draft: JsonSchemaDialect): Promise<Record<string, unknown>[]> {
  if (draft !== "draft-2019-09" && draft !== "draft-2020-12") {
    return [];
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const vocabDir = join(__dirname, "..", "..", "schemas", "crucible-ts", "meta", draft, "meta");

  const vocabFiles =
    draft === "draft-2020-12"
      ? [
          "core.json",
          "applicator.json",
          "unevaluated.json",
          "validation.json",
          "meta-data.json",
          "format-annotation.json",
          "content.json",
        ]
      : [
          "core.json",
          "applicator.json",
          "validation.json",
          "meta-data.json",
          "format.json",
          "content.json",
        ];

  const schemas: Record<string, unknown>[] = [];
  for (const file of vocabFiles) {
    try {
      const content = await readFile(join(vocabDir, file), "utf-8");
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
 *
 * Per Canonical URI Resolution Standard (v0.4.2+), crucible-hosted schemas use:
 *   https://schemas.fulmenhq.dev/crucible/<topic>/<version>/<filename>
 *
 * We only embed crucible schemas locally. Other modules (goneat/, enact/, etc.)
 * are not embedded and cannot be resolved offline.
 */
async function loadReferencedSchema(uri: string): Promise<Record<string, unknown>> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const repoRoot = join(__dirname, "..", "..");

  let resolvedPath: string;

  // Handle https://schemas.fulmenhq.dev/ URIs - map to local files
  if (uri.startsWith("https://schemas.fulmenhq.dev/")) {
    let relativePath = uri.replace("https://schemas.fulmenhq.dev/", "");

    // Strip crucible/ module prefix if present (v0.4.2+ canonical URIs)
    // We only embed crucible schemas - other modules cannot be resolved locally
    if (relativePath.startsWith("crucible/")) {
      relativePath = relativePath.slice("crucible/".length);
    }

    // Check if it's a config taxonomy reference
    if (relativePath.startsWith("config/taxonomy/")) {
      resolvedPath = join(
        repoRoot,
        "config",
        "crucible-ts",
        "taxonomy",
        relativePath.split("/").pop() || "",
      );
    } else {
      // Schema reference - map to schemas/crucible-ts/
      resolvedPath = join(repoRoot, "schemas", "crucible-ts", relativePath);
    }
  }
  // Handle relative paths (e.g., "../../../../config/taxonomy/metrics.yaml")
  else if (uri.startsWith("../../") || uri.startsWith("../")) {
    // Resolve relative to schemas/crucible-ts/observability/metrics/v1.0.0/
    // (where metrics-event.schema.json is located)
    const schemaBase = join(
      repoRoot,
      "schemas",
      "crucible-ts",
      "observability",
      "metrics",
      "v1.0.0",
    );
    resolvedPath = join(schemaBase, uri);
  }
  // Handle file:// URIs
  else if (uri.startsWith("file://")) {
    resolvedPath = fileURLToPath(uri);
  }
  // Unhandled URI scheme
  else {
    throw new Error(`Cannot load remote schema: ${uri}`);
  }

  // Read and parse the file
  const content = await readFile(resolvedPath, "utf-8");
  const ext = resolvedPath.split(".").pop()?.toLowerCase();

  if (ext === "yaml" || ext === "yml") {
    return parseYAML(content) as Record<string, unknown>;
  }
  return JSON.parse(content) as Record<string, unknown>;
}

/**
 * Resolve JSON Schema dialect from schema content.
 */
function detectDialect(schema: unknown): JsonSchemaDialect {
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    const maybeSchema = schema as Record<string, unknown>;
    const declared = (maybeSchema as { $schema?: unknown }).$schema;

    if (typeof declared === "string") {
      if (declared.includes("draft-04")) return "draft-04";
      if (declared.includes("draft-06")) return "draft-06";
      if (declared.includes("draft-07")) return "draft-07";
      if (declared.includes("draft/2019-09")) return "draft-2019-09";
      if (declared.includes("draft/2020-12")) return "draft-2020-12";
    }
  }

  // Default to 2020-12 in Fulmen ecosystem.
  return "draft-2020-12";
}

/**
 * Create AJV instance for a specific dialect
 */
function createAjv(dialect: JsonSchemaDialect): Ajv {
  const AjvCtor =
    dialect === "draft-2020-12"
      ? Ajv2020
      : dialect === "draft-2019-09"
        ? Ajv2019
        : dialect === "draft-04"
          ? (AjvDraft04 as unknown as typeof Ajv)
          : Ajv;

  const ajv = new AjvCtor({
    strict: false,
    allErrors: true,
    verbose: true,
    // Allow schemas with $id to be added without replacing existing ones
    addUsedSchema: false,
    // draft-04 uses "id"; later drafts use "$id"
    schemaId: dialect === "draft-04" ? "id" : "$id",
    // Enable async schema loading for YAML references
    loadSchema: loadReferencedSchema,
  });

  applyFulmenAjvFormats(ajv);

  return ajv;
}

/**
 * Get or create AJV instance for a dialect, ensuring metaschemas are loaded.
 */
async function getAjv(dialect: JsonSchemaDialect): Promise<Ajv> {
  const existing = ajvInstances.get(dialect);
  if (existing) {
    const ready = metaschemaReady.get(dialect);
    if (ready) await ready;
    return existing;
  }

  const ajv = createAjv(dialect);
  ajvInstances.set(dialect, ajv);

  const readyPromise = Promise.all([loadVocabularySchemas(dialect), loadMetaSchema(dialect)])
    .then(([vocabSchemas, metaSchema]) => {
      // Add vocabulary schemas first (referenced by meta schema)
      for (const vocabSchema of vocabSchemas) {
        try {
          ajv.addMetaSchema(vocabSchema);
        } catch {
          // Already added or incompatible with Ajv's built-ins
        }
      }

      try {
        ajv.addMetaSchema(metaSchema);
      } catch {
        // Already added or incompatible with Ajv's built-ins
      }
    })
    .catch((error) => {
      throw new Error(`Failed to load metaschemas (${dialect}): ${error}`);
    });

  metaschemaReady.set(dialect, readyPromise);
  await readyPromise;

  return ajv;
}

/**
 * Compile a schema for validation
 */
export async function compileSchema(
  schema: SchemaInput,
  options: { aliases?: string[] } = {},
): Promise<CompiledValidator> {
  const baseKey = typeof schema === "string" ? schema : JSON.stringify(schema);

  let parsedSchema: unknown;
  if (typeof schema === "string") {
    try {
      parsedSchema = JSON.parse(schema);
    } catch {
      // Try YAML if JSON parsing fails
      parsedSchema = parseYAML(schema);
    }
  } else if (Buffer.isBuffer(schema)) {
    const content = schema.toString("utf-8");
    try {
      parsedSchema = JSON.parse(content);
    } catch {
      parsedSchema = parseYAML(content);
    }
  } else {
    parsedSchema = schema;
  }

  const dialect = detectDialect(parsedSchema);
  const ajv = await getAjv(dialect);

  const cacheKey = `${dialect}:${baseKey}`;
  const cached = schemaCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    // Register schema aliases (e.g., alternate $id values) before compile to support relative refs
    if (options.aliases && options.aliases.length > 0) {
      for (const alias of options.aliases) {
        if (alias && ajv.getSchema(alias) === undefined) {
          try {
            if (typeof parsedSchema === "object" && parsedSchema !== null) {
              ajv.addSchema(parsedSchema as Record<string, unknown>, alias);
            }
          } catch {
            // Ignore if alias already registered or invalid
          }
        }
      }
    }

    const validator =
      typeof parsedSchema === "boolean"
        ? ajv.compile(parsedSchema)
        : await ajv.compileAsync(parsedSchema as Record<string, unknown>);

    // Cache the compiled validator
    schemaCache.set(cacheKey, validator as CompiledValidator);

    return validator as CompiledValidator;
  } catch (error) {
    throw SchemaValidationError.parseFailed(
      {
        type: "string",
        content: typeof schema === "string" ? schema : JSON.stringify(schema),
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
    source: "ajv",
  };

  if (!valid && validator.errors) {
    const errors = validator.errors;
    if (Array.isArray(errors)) {
      result.diagnostics = errors.map((error) =>
        createDiagnostic(
          error.instancePath || "",
          error.message || "Validation failed",
          error.keyword || "unknown",
          "ERROR",
          "ajv",
        ),
      );
    }
    metrics.counter("schema_validation_errors").inc();
  } else {
    metrics.counter("schema_validations").inc();
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
    const content = await readFile(filePath, "utf-8");
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
          "",
          `Failed to read or parse file: ${(error as Error).message}`,
          "file-read",
          "ERROR",
          "ajv",
        ),
      ],
      { type: "file", id: filePath },
    );
  }
}

/**
 * Validate a schema document itself
 */
export async function validateSchema(schema: SchemaInput): Promise<SchemaValidationResult> {
  try {
    // Parse schema so we can both meta-validate and compile with dialect-specific Ajv.
    let parsedSchema: unknown;
    if (typeof schema === "string") {
      try {
        parsedSchema = JSON.parse(schema);
      } catch {
        parsedSchema = parseYAML(schema);
      }
    } else if (Buffer.isBuffer(schema)) {
      const content = schema.toString("utf-8");
      try {
        parsedSchema = JSON.parse(content);
      } catch {
        parsedSchema = parseYAML(content);
      }
    } else {
      parsedSchema = schema;
    }

    const dialect = detectDialect(parsedSchema);
    const ajv = await getAjv(dialect);

    // 1) Meta validation against declared dialect
    const metaValid = ajv.validateSchema(parsedSchema as AnySchema);
    if (!metaValid && ajv.errors) {
      const diagnostics = ajv.errors.map((error) =>
        createDiagnostic(
          error.instancePath || "",
          error.message || "Schema meta-validation failed",
          error.keyword || "unknown",
          "ERROR",
          "ajv",
        ),
      );

      return { valid: false, diagnostics, source: "ajv" };
    }

    // 2) Compilation check (refs resolvable, keywords supported)
    await compileSchema(parsedSchema as SchemaInput);

    return {
      valid: true,
      diagnostics: [],
      source: "ajv",
    };
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return {
        valid: false,
        diagnostics: error.diagnostics,
        source: "ajv",
      };
    }

    return {
      valid: false,
      diagnostics: [
        createDiagnostic(
          "",
          `Schema validation failed: ${(error as Error).message}`,
          "schema-validation",
          "ERROR",
          "ajv",
        ),
      ],
      source: "ajv",
    };
  }
}

/**
 * Clear schema cache
 */
export function clearCache(): void {
  schemaCache.clear();
  // Keep Ajv instances cached; they hold metaschemas. Tests can still clear schema cache.
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

    const content = await readFile(metadata.path, "utf-8");
    const aliases: string[] = [];

    const normalizedRelativePath = metadata.relativePath.replace(/\\/g, "/");
    if (normalizedRelativePath) {
      // Per Canonical URI Resolution Standard (v0.4.2+), include crucible/ module prefix
      aliases.push(
        new URL(`crucible/${normalizedRelativePath}`, "https://schemas.fulmenhq.dev/").toString(),
      );
    }

    return compileSchema(content, { aliases });
  } catch (error) {
    metrics.counter("schema_validation_errors").inc();
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
    metrics.counter("schema_validation_errors").inc();
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
    metrics.counter("schema_validation_errors").inc();
    throw error;
  }
}
