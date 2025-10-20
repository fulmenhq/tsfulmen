/**
 * Schema registry - implements schema discovery and metadata extraction
 */

import { access, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'fast-glob';
import { parse as parseYAML } from 'yaml';
import { SchemaValidationError } from './errors.js';
import type { SchemaFormat, SchemaMetadata, SchemaRegistryOptions } from './types.js';

/**
 * Default schema file patterns
 */
const DEFAULT_PATTERNS = ['**/*.schema.json', '**/*.schema.yaml', '**/*.schema.yml'];

/**
 * Schema registry class for managing schema discovery and metadata
 */
export class SchemaRegistry {
  private schemas: Map<string, SchemaMetadata> = new Map();
  private options: SchemaRegistryOptions;

  constructor(options: SchemaRegistryOptions = {}) {
    this.options = {
      baseDir: options.baseDir || this.getDefaultSchemaDir(),
      patterns: options.patterns || DEFAULT_PATTERNS,
      followSymlinks: options.followSymlinks ?? false,
      maxDepth: options.maxDepth ?? 10,
    };
  }

  /**
   * Get default schema directory using import.meta.url
   */
  private getDefaultSchemaDir(): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // From src/schema/ we need to go up 2 levels to repo root, then into schemas/crucible-ts
    return join(__dirname, '..', '..', 'schemas', 'crucible-ts');
  }

  /**
   * Build logical schema ID from file path
   */
  private buildSchemaId(filePath: string, baseDir: string): string {
    const relativePath = relative(baseDir, filePath);
    const withoutExt = relativePath.replace(/\.(schema\.(json|yaml|yml))$/, '');
    return withoutExt.replace(/\\/g, '/'); // Normalize path separators
  }

  /**
   * Extract schema format from file extension
   */
  private getSchemaFormat(filePath: string): SchemaFormat {
    const ext = extname(filePath).toLowerCase();
    switch (ext) {
      case '.json':
        return 'json';
      case '.yaml':
      case '.yml':
        return 'yaml';
      default:
        return 'json'; // Default fallback
    }
  }

  /**
   * Extract metadata from schema file
   */
  private async extractMetadata(filePath: string): Promise<SchemaMetadata> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const format = this.getSchemaFormat(filePath);

      let parsed: Record<string, unknown>;
      if (format === 'yaml') {
        parsed = parseYAML(content) as Record<string, unknown>;
      } else {
        parsed = JSON.parse(content) as Record<string, unknown>;
      }

      const baseDir = this.options.baseDir ?? '';
      const relativePath = relative(baseDir, filePath);

      return {
        id: this.buildSchemaId(filePath, baseDir),
        path: filePath,
        relativePath: relativePath,
        format,
        version: (parsed.$schema as string) || (parsed.version as string),
        description: (parsed.title as string) || (parsed.description as string),
        schemaDraft: parsed.$schema as string,
      };
    } catch (error) {
      throw SchemaValidationError.registryError(
        'metadata extraction',
        `Failed to process ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Discover and index all available schemas
   */
  async discoverSchemas(): Promise<void> {
    try {
      const baseDir = this.options.baseDir ?? '';
      const patterns = this.options.patterns ?? [];

      if (patterns.length === 0) {
        this.schemas.clear();
        return;
      }

      const pattern = patterns.map((p) => join(baseDir, p));

      // Check if base directory exists
      try {
        await access(baseDir);
      } catch {
        // Base directory doesn't exist, clear registry and return
        this.schemas.clear();
        return;
      }

      const files = await glob(pattern, {
        absolute: true,
        followSymbolicLinks: this.options.followSymlinks,
        deep: this.options.maxDepth,
        onlyFiles: true,
        suppressErrors: true, // Don't throw on permission errors
      });

      // Clear existing schemas
      this.schemas.clear();

      // Process each schema file
      for (const filePath of files) {
        try {
          const metadata = await this.extractMetadata(filePath);
          this.schemas.set(metadata.id, metadata);
        } catch (error) {
          // Log error but continue processing other schemas
          console.warn(`Warning: Failed to process schema ${filePath}:`, error);
        }
      }
    } catch (error) {
      throw SchemaValidationError.registryError('discovery', (error as Error).message);
    }
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

    const absolutePath = filePath.startsWith('/') ? filePath : join(process.cwd(), filePath);

    for (const schema of this.schemas.values()) {
      if (schema.path === absolutePath) {
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
