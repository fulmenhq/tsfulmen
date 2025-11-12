/**
 * Schema export utilities - implements schema export with provenance
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYAML, stringify as stringifyYAML } from "yaml";
import { SchemaExportError, SchemaValidationError } from "./errors.js";
import { getSchemaRegistry } from "./registry.js";
import type {
  ExportSchemaOptions,
  ExportSchemaResult,
  SchemaExportFormat,
  SchemaProvenanceMetadata,
} from "./types.js";
import { validateSchema } from "./validator.js";

/**
 * Extract provenance metadata from Crucible sync metadata
 */
async function extractProvenanceMetadata(schemaId: string): Promise<SchemaProvenanceMetadata> {
  try {
    // Read Crucible metadata using proper path resolution
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const metadataPath = join(__dirname, "..", "..", ".crucible", "metadata", "metadata.yaml");
    const metadataContent = await readFile(metadataPath, "utf-8");

    // Parse YAML properly to avoid brittle regex matching
    const metadata = parseYAML(metadataContent) as {
      sources?: Array<{
        name?: string;
        version?: string;
        commit?: string;
      }>;
    };

    // Extract Crucible source metadata (first source is typically 'crucible')
    const crucibleSource = metadata.sources?.[0];
    const crucibleVersion = crucibleSource?.version || "unknown";
    const revision = crucibleSource?.commit;

    // Read library version from package.json
    const pkgPath = join(__dirname, "..", "..", "package.json");
    const pkgContent = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent) as { version: string };

    return {
      schema_id: schemaId,
      crucible_version: crucibleVersion,
      library_version: pkg.version,
      revision: revision,
      exported_at: new Date().toISOString(),
      export_source: "tsfulmen",
    };
  } catch (error) {
    throw SchemaExportError.provenanceFailed((error as Error).message, error as Error);
  }
}

/**
 * Embed provenance metadata in schema content
 */
function embedProvenance(
  schemaContent: Record<string, unknown>,
  provenance: SchemaProvenanceMetadata,
  format: SchemaExportFormat,
): string {
  if (format === "json") {
    // For JSON: embed under $comment["x-crucible-source"]
    const withProvenance = {
      ...schemaContent,
      $comment: {
        ...(typeof schemaContent.$comment === "object" ? schemaContent.$comment : {}),
        "x-crucible-source": provenance,
      },
    };
    return JSON.stringify(withProvenance, null, 2);
  }

  // For YAML: prepend comment block
  const yamlContent = stringifyYAML(schemaContent, {
    indent: 2,
    lineWidth: 0,
  });

  const provenanceComment = [
    "# x-crucible-source:",
    `#   schema_id: ${provenance.schema_id}`,
    `#   crucible_version: ${provenance.crucible_version}`,
    `#   library_version: ${provenance.library_version}`,
    ...(provenance.revision ? [`#   revision: ${provenance.revision}`] : []),
    `#   exported_at: ${provenance.exported_at}`,
    `#   export_source: ${provenance.export_source}`,
    "",
  ].join("\n");

  return provenanceComment + yamlContent;
}

/**
 * Detect export format from file extension or explicit option
 */
function detectFormat(outPath: string, formatOption?: SchemaExportFormat): SchemaExportFormat {
  if (formatOption && formatOption !== "auto") {
    return formatOption;
  }

  const ext = extname(outPath).toLowerCase();
  switch (ext) {
    case ".json":
      return "json";
    case ".yaml":
    case ".yml":
      return "yaml";
    default:
      throw SchemaExportError.invalidFormat(ext, outPath);
  }
}

/**
 * Export schema from registry to file with provenance
 *
 * @param options - Export options
 * @returns Export result with metadata
 *
 * @throws {SchemaExportError} If export fails
 * @throws {SchemaValidationError} If schema not found or validation fails
 *
 * @example
 * ```typescript
 * import { exportSchema } from '@fulmenhq/tsfulmen/schema';
 *
 * await exportSchema({
 *   schemaId: 'library/foundry/v1.0.0/exit-codes',
 *   outPath: './schemas/exit-codes.schema.json',
 *   includeProvenance: true,
 *   validate: true,
 * });
 * ```
 */
export async function exportSchema(options: ExportSchemaOptions): Promise<ExportSchemaResult> {
  const {
    schemaId,
    outPath,
    includeProvenance = true,
    validate = true,
    overwrite = false,
    format: formatOption,
    baseDir,
  } = options;

  // Detect output format
  const format = detectFormat(outPath, formatOption);

  // Check if file exists
  if (!overwrite) {
    try {
      await access(outPath);
      throw SchemaExportError.fileExists(outPath);
    } catch (error) {
      // File doesn't exist - proceed
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  // Get schema from registry
  const registry = getSchemaRegistry({ baseDir });
  const schema = await registry.getSchema(schemaId);

  // Read schema content
  const schemaContent = await readFile(schema.path, "utf-8");

  // Validate if requested
  if (validate) {
    const validationResult = await validateSchema(schemaContent);
    if (!validationResult.valid) {
      throw SchemaValidationError.validationFailed(schemaId, validationResult.diagnostics, {
        type: "file",
        id: schema.path,
      });
    }
  }

  // Parse schema content
  let schemaObject: Record<string, unknown>;
  try {
    schemaObject = JSON.parse(schemaContent) as Record<string, unknown>;
  } catch {
    schemaObject = parseYAML(schemaContent) as Record<string, unknown>;
  }

  // Freeze schema object to prevent mutation
  Object.freeze(schemaObject);

  let provenance: SchemaProvenanceMetadata | undefined;
  let outputContent: string;

  if (includeProvenance) {
    // Extract provenance metadata
    provenance = await extractProvenanceMetadata(schemaId);

    // Embed provenance in output
    outputContent = embedProvenance(schemaObject, provenance, format);
  } else {
    // Export without provenance
    if (format === "json") {
      outputContent = JSON.stringify(schemaObject, null, 2);
    } else {
      outputContent = stringifyYAML(schemaObject, { indent: 2, lineWidth: 0 });
    }
  }

  // Ensure output directory exists
  await mkdir(dirname(outPath), { recursive: true });

  // Write to file
  try {
    await writeFile(outPath, outputContent, "utf-8");
  } catch (error) {
    throw SchemaExportError.writeFailed(outPath, error as Error);
  }

  return {
    success: true,
    schemaId,
    outPath,
    format,
    includeProvenance,
    provenance,
  };
}

/**
 * Strip provenance metadata from schema content
 *
 * This helper is useful for comparing exported schemas with runtime
 * schemas or validating that provenance doesn't affect schema semantics.
 *
 * @param content - Schema content (JSON or YAML string)
 * @returns Schema content without provenance metadata
 *
 * @example
 * ```typescript
 * import { stripProvenance } from '@fulmenhq/tsfulmen/schema';
 *
 * const exported = await readFile('./schema.json', 'utf-8');
 * const withoutProvenance = stripProvenance(exported);
 * ```
 */
export function stripProvenance(content: string): string {
  try {
    // Try parsing as JSON
    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Remove provenance from $comment
    if (parsed.$comment && typeof parsed.$comment === "object") {
      const comment = { ...parsed.$comment } as Record<string, unknown>;
      delete comment["x-crucible-source"];

      // Remove $comment entirely if it's now empty
      if (Object.keys(comment).length === 0) {
        delete parsed.$comment;
      } else {
        parsed.$comment = comment;
      }
    }

    return JSON.stringify(parsed, null, 2);
  } catch {
    // YAML format - strip comment lines
    const lines = content.split("\n");
    const filtered = lines.filter((line) => {
      const trimmed = line.trim();
      return !(
        trimmed.startsWith("# x-crucible-source:") ||
        (trimmed.startsWith("#   ") &&
          /^#\s+(schema_id|crucible_version|library_version|revision|exported_at|export_source):/.test(
            trimmed,
          ))
      );
    });

    // Remove leading blank lines
    while (filtered.length > 0 && filtered[0]?.trim() === "") {
      filtered.shift();
    }

    return filtered.join("\n");
  }
}
