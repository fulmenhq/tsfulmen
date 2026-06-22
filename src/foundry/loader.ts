/**
 * Foundry module - SSOT data loader
 *
 * Loads and validates Foundry catalog data from Crucible SSOT assets
 * with Bun-first approach and comprehensive schema validation.
 */

import { parse as parseYaml } from "yaml";
import { getAssetResolver } from "../assets/index.js";
import { validateDataBySchemaId } from "../schema/validator.js";
import { ensureFoundryAssetsRegistered } from "./embedded-assets.js";
import { FoundryCatalogError } from "./errors.js";
import type {
  CountryCatalog,
  HttpStatusCatalog,
  MimeTypeCatalog,
  PatternCatalog,
} from "./types.js";

// SSOT asset logical paths (package-root-relative; resolved via the AssetResolver
// so they work from the filesystem AND from embedded modules in a compiled binary).
const SSOT_PATHS = {
  patterns: "config/crucible-ts/library/foundry/patterns.yaml",
  httpStatuses: "config/crucible-ts/library/foundry/http-statuses.yaml",
  mimeTypes: "config/crucible-ts/library/foundry/mime-types.yaml",
  countryCodes: "config/crucible-ts/library/foundry/country-codes.yaml",
} as const;

// Schema IDs for Foundry catalogs (from Crucible SSOT)
const SCHEMA_IDS = {
  patterns: "library/foundry/v1.0.0/patterns",
  httpStatuses: "library/foundry/v1.0.0/http-status-groups",
  mimeTypes: "library/foundry/v1.0.0/mime-types",
  countryCodes: "library/foundry/v1.0.0/country-codes",
} as const;

/**
 * Load and validate a Foundry catalog from YAML file
 * Bun-first approach with Node.js fallback
 */
async function loadCatalog<T>(
  logicalPath: string,
  catalogName: string,
  schemaId: string,
): Promise<T> {
  try {
    ensureFoundryAssetsRegistered();
    const resolver = getAssetResolver();

    let content: string;
    try {
      content = await resolver.read(logicalPath);
    } catch {
      // Missing from both the filesystem and embedded modules.
      throw FoundryCatalogError.missingCatalog(catalogName);
    }

    // Parse YAML content
    const data = parseYaml(content) as T;

    // Validate against JSON Schema from Crucible SSOT
    const result = await validateDataBySchemaId(data, schemaId);
    if (!result.valid) {
      const errorMessages = result.diagnostics.map((d) => `${d.pointer}: ${d.message}`).join("; ");
      throw FoundryCatalogError.invalidSchema(
        catalogName,
        `Schema validation failed: ${errorMessages}`,
      );
    }

    return data;
  } catch (error) {
    if (error instanceof FoundryCatalogError) {
      throw error;
    }
    throw FoundryCatalogError.invalidSchema(catalogName, "Failed to load catalog", error as Error);
  }
}

/**
 * Load Pattern Catalog from SSOT
 */
export async function loadPatternCatalog(): Promise<PatternCatalog> {
  return loadCatalog<PatternCatalog>(SSOT_PATHS.patterns, "patterns", SCHEMA_IDS.patterns);
}

/**
 * Load HTTP Status Catalog from SSOT
 */
export async function loadHttpStatusCatalog(): Promise<HttpStatusCatalog> {
  return loadCatalog<HttpStatusCatalog>(
    SSOT_PATHS.httpStatuses,
    "httpStatuses",
    SCHEMA_IDS.httpStatuses,
  );
}

/**
 * Load MIME Type Catalog from SSOT
 */
export async function loadMimeTypeCatalog(): Promise<MimeTypeCatalog> {
  return loadCatalog<MimeTypeCatalog>(SSOT_PATHS.mimeTypes, "mimeTypes", SCHEMA_IDS.mimeTypes);
}

/**
 * Load Country Code Catalog from SSOT
 */
export async function loadCountryCodeCatalog(): Promise<CountryCatalog> {
  return loadCatalog<CountryCatalog>(
    SSOT_PATHS.countryCodes,
    "countryCodes",
    SCHEMA_IDS.countryCodes,
  );
}

/**
 * Load all Foundry catalogs
 */
export async function loadAllCatalogs(): Promise<{
  patterns: PatternCatalog;
  httpStatuses: HttpStatusCatalog;
  mimeTypes: MimeTypeCatalog;
  countryCodes: CountryCatalog;
}> {
  const [patterns, httpStatuses, mimeTypes, countryCodes] = await Promise.all([
    loadPatternCatalog(),
    loadHttpStatusCatalog(),
    loadMimeTypeCatalog(),
    loadCountryCodeCatalog(),
  ]);

  return { patterns, httpStatuses, mimeTypes, countryCodes };
}
