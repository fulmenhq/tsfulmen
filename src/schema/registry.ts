/**
 * Schema registry - implements schema discovery and metadata extraction
 */

import { extname } from "node:path";
import { parse as parseYAML } from "yaml";
import { type AssetResolver, getAssetResolver, resolveAssets } from "../assets/index.js";
import { ensureSchemaAssetsRegistered } from "./embedded-assets.js";
import { SchemaValidationError } from "./errors.js";
import type { SchemaFormat, SchemaMetadata, SchemaRegistryOptions } from "./types.js";

/**
 * Default schema file patterns (relative to the logical base).
 */
const DEFAULT_PATTERNS = ["**/*.schema.json", "**/*.schema.yaml", "**/*.schema.yml"];

/** Logical namespace of the package's own bundled schemas. */
const PACKAGE_SCHEMA_BASE = "schemas/crucible-ts/";

/**
 * Schema registry class for managing schema discovery and metadata.
 *
 * Resolves schemas via the {@link AssetResolver} (filesystem or embedded), so it
 * works from npm/`node dist` AND inside a `bun --compile` binary. `SchemaMetadata.path`
 * is a logical (resolver-relative) path, read back through the resolver — not an
 * absolute filesystem path (v0.4.0).
 */
export class SchemaRegistry {
  private schemas: Map<string, SchemaMetadata> = new Map();
  private options: SchemaRegistryOptions;
  private resolver: AssetResolver | null = null;
  private logicalBase = "";

  constructor(options: SchemaRegistryOptions = {}) {
    this.options = {
      baseDir: options.baseDir, // undefined => the package's bundled crucible-ts schemas
      patterns: options.patterns || DEFAULT_PATTERNS,
      followSymlinks: options.followSymlinks ?? false,
      maxDepth: options.maxDepth ?? 10,
    };
  }

  /**
   * Resolve the asset source + logical base for the configured mode.
   * - custom `baseDir`: a consumer-owned tree, read directly (patterns relative to it);
   * - default: the package's bundled crucible-ts schemas (filesystem or embedded).
   */
  private resolveSource(): { resolver: AssetResolver; logicalBase: string } {
    if (this.options.baseDir) {
      return { resolver: resolveAssets({ baseDir: this.options.baseDir }), logicalBase: "" };
    }
    ensureSchemaAssetsRegistered();
    return { resolver: getAssetResolver(), logicalBase: PACKAGE_SCHEMA_BASE };
  }

  /**
   * Build logical schema ID from a logical path (strip the base + schema ext).
   */
  private buildSchemaId(logicalPath: string): string {
    const rel = logicalPath.startsWith(this.logicalBase)
      ? logicalPath.slice(this.logicalBase.length)
      : logicalPath;
    return rel.replace(/\.(schema\.(json|yaml|yml))$/, "").replace(/\\/g, "/");
  }

  /**
   * Extract schema format from file extension
   */
  private getSchemaFormat(logicalPath: string): SchemaFormat {
    const ext = extname(logicalPath).toLowerCase();
    return ext === ".yaml" || ext === ".yml" ? "yaml" : "json";
  }

  /**
   * Extract metadata from a schema asset (read via the resolver).
   */
  private async extractMetadata(logicalPath: string): Promise<SchemaMetadata> {
    if (!this.resolver) {
      throw SchemaValidationError.registryError("metadata extraction", "resolver not initialized");
    }
    try {
      const content = await this.resolver.read(logicalPath);
      const format = this.getSchemaFormat(logicalPath);
      const parsed = (format === "yaml" ? parseYAML(content) : JSON.parse(content)) as Record<
        string,
        unknown
      >;

      const relativePath = logicalPath.startsWith(this.logicalBase)
        ? logicalPath.slice(this.logicalBase.length)
        : logicalPath;

      return {
        id: this.buildSchemaId(logicalPath),
        path: logicalPath,
        relativePath,
        format,
        version: (parsed.$schema as string) || (parsed.version as string),
        description: (parsed.title as string) || (parsed.description as string),
        schemaDraft: parsed.$schema as string,
      };
    } catch (error) {
      throw SchemaValidationError.registryError(
        "metadata extraction",
        `Failed to process ${logicalPath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Discover and index all available schemas (via resolver.list — no FS walk).
   */
  async discoverSchemas(): Promise<void> {
    try {
      const patterns = this.options.patterns ?? [];
      if (patterns.length === 0) {
        this.schemas.clear();
        return;
      }

      const { resolver, logicalBase } = this.resolveSource();
      this.resolver = resolver;
      this.logicalBase = logicalBase;

      const effectivePatterns = patterns.map((p) => `${logicalBase}${p}`);
      const logicalPaths = await resolver.list(effectivePatterns);

      this.schemas.clear();
      for (const logicalPath of logicalPaths) {
        try {
          const metadata = await this.extractMetadata(logicalPath);
          this.schemas.set(metadata.id, metadata);
        } catch (error) {
          console.warn(`Warning: Failed to process schema ${logicalPath}:`, error);
        }
      }
    } catch (error) {
      throw SchemaValidationError.registryError("discovery", (error as Error).message);
    }
  }

  /**
   * Read raw schema content by logical ID, via the configured resolver.
   */
  async readSchemaContent(id: string): Promise<string> {
    const metadata = await this.getSchema(id);
    if (!this.resolver) {
      throw SchemaValidationError.registryError("read", "resolver not initialized");
    }
    return this.resolver.read(metadata.path);
  }

  /**
   * List available schemas with optional prefix filtering
   */
  async listSchemas(prefix?: string): Promise<SchemaMetadata[]> {
    if (this.schemas.size === 0) {
      await this.discoverSchemas();
    }

    const schemas = Array.from(this.schemas.values());

    if (prefix) {
      return schemas.filter((schema) => schema.id.startsWith(prefix));
    }

    return schemas;
  }

  /**
   * Get schema by logical ID
   */
  async getSchema(id: string): Promise<SchemaMetadata> {
    if (this.schemas.size === 0) {
      await this.discoverSchemas();
    }

    const schema = this.schemas.get(id);
    if (!schema) {
      throw SchemaValidationError.schemaNotFound(id);
    }

    return schema;
  }

  /**
   * Get schema by file path
   */
  async getSchemaByPath(filePath: string): Promise<SchemaMetadata> {
    if (this.schemas.size === 0) {
      await this.discoverSchemas();
    }

    // Paths are now logical (resolver-relative). Match the logical path or its
    // base-relative form, tolerating a leading "./" and separator differences.
    const norm = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
    for (const schema of this.schemas.values()) {
      if (
        schema.path === norm ||
        schema.relativePath === norm ||
        schema.path.endsWith(`/${norm}`)
      ) {
        return schema;
      }
    }

    throw SchemaValidationError.schemaNotFound(filePath);
  }

  /**
   * Check if schema exists
   */
  async hasSchema(id: string): Promise<boolean> {
    if (this.schemas.size === 0) {
      await this.discoverSchemas();
    }

    return this.schemas.has(id);
  }

  /**
   * Get registry size
   */
  get size(): number {
    return this.schemas.size;
  }

  /**
   * Clear registry cache
   */
  clear(): void {
    this.schemas.clear();
  }
}

/**
 * Global schema registry instance with cached options
 */
let globalRegistry: SchemaRegistry | undefined;
let globalRegistryOptions: SchemaRegistryOptions | undefined;

/**
 * Check if registry options have changed
 */
function optionsChanged(newOptions?: SchemaRegistryOptions): boolean {
  if (!newOptions && !globalRegistryOptions) return false;
  if (!newOptions || !globalRegistryOptions) return true;

  return (
    newOptions.baseDir !== globalRegistryOptions.baseDir ||
    JSON.stringify(newOptions.patterns) !== JSON.stringify(globalRegistryOptions.patterns) ||
    newOptions.followSymlinks !== globalRegistryOptions.followSymlinks ||
    newOptions.maxDepth !== globalRegistryOptions.maxDepth
  );
}

/**
 * Get or create global schema registry, rebuilding if options change
 */
export function getSchemaRegistry(options?: SchemaRegistryOptions): SchemaRegistry {
  if (!globalRegistry || optionsChanged(options)) {
    globalRegistry = new SchemaRegistry(options);
    globalRegistryOptions = options;
  }
  return globalRegistry;
}

/**
 * List available schemas with optional prefix filtering
 */
export async function listSchemas(
  prefix?: string,
  options?: SchemaRegistryOptions,
): Promise<SchemaMetadata[]> {
  const registry = getSchemaRegistry(options);
  return registry.listSchemas(prefix);
}

/**
 * Get schema by logical ID
 */
export async function getSchema(
  id: string,
  options?: SchemaRegistryOptions,
): Promise<SchemaMetadata> {
  const registry = getSchemaRegistry(options);
  return registry.getSchema(id);
}

/**
 * Get schema by file path
 */
export async function getSchemaByPath(
  filePath: string,
  options?: SchemaRegistryOptions,
): Promise<SchemaMetadata> {
  const registry = getSchemaRegistry(options);
  return registry.getSchemaByPath(filePath);
}

/**
 * Check if schema exists
 */
export async function hasSchema(id: string, options?: SchemaRegistryOptions): Promise<boolean> {
  const registry = getSchemaRegistry(options);
  return registry.hasSchema(id);
}
