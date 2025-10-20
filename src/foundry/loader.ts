/**
 * Foundry module - SSOT data loader
 *
 * Loads and validates Foundry catalog data from Crucible SSOT assets
 * with Bun-first approach and comprehensive schema validation.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { FoundryCatalogError } from './errors.js';
import type {
  CountryCatalog,
  HttpStatusCatalog,
  MimeTypeCatalog,
  PatternCatalog,
} from './types.js';

// Get the directory of the current module file for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SSOT Asset Paths (relative to module file, resolved to absolute paths)
const SSOT_PATHS = {
  patterns: join(__dirname, '../../config/crucible-ts/library/foundry/patterns.yaml'),
  httpStatuses: join(__dirname, '../../config/crucible-ts/library/foundry/http-statuses.yaml'),
  mimeTypes: join(__dirname, '../../config/crucible-ts/library/foundry/mime-types.yaml'),
  countryCodes: join(__dirname, '../../config/crucible-ts/library/foundry/country-codes.yaml'),
} as const;

// Schema validation will be implemented using existing schema infrastructure
// For now, we'll do basic structure validation

/**
 * Load and validate a Foundry catalog from YAML file
 * Bun-first approach with Node.js fallback
 */
async function loadCatalog<T>(filePath: string, catalogName: string): Promise<T> {
  try {
    let content: string;

    // Bun-first approach
    if (typeof Bun !== 'undefined') {
      try {
        const file = Bun.file(filePath);
        if (!(await file.exists())) {
          throw FoundryCatalogError.missingCatalog(catalogName);
        }
        content = await file.text();
      } catch (error) {
        // Handle Bun-specific errors
        if (error instanceof Error && error.message.includes('No such file')) {
          throw FoundryCatalogError.missingCatalog(catalogName);
        }
        throw error;
      }
    } else {
      // Node.js fallback
      try {
        content = await readFile(filePath, 'utf-8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw FoundryCatalogError.missingCatalog(catalogName);
        }
        throw error;
      }
    }

    // Parse YAML content
    const data = parseYaml(content) as T;

    // Basic validation (schema validation will be added later)
    validateCatalogStructure(data, catalogName);

    return data;
  } catch (error) {
    if (error instanceof FoundryCatalogError) {
      throw error;
    }

    // Distinguish between different types of file access errors
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw FoundryCatalogError.missingCatalog(catalogName);
    } else if (err.code === 'EACCES') {
      throw FoundryCatalogError.invalidSchema(
        catalogName,
        'Permission denied accessing catalog file',
        err,
      );
    } else if (err.code === 'EISDIR') {
      throw FoundryCatalogError.invalidSchema(
        catalogName,
        'Expected file but found directory',
        err,
      );
    } else if (err.code === 'EMFILE' || err.code === 'ENFILE') {
      throw FoundryCatalogError.invalidSchema(catalogName, 'Too many open files', err);
    }

    throw FoundryCatalogError.invalidSchema(catalogName, 'Failed to load catalog', err);
  }
}

/**
 * Basic structure validation for catalogs
 * TODO: Replace with proper JSON Schema validation using src/schema/ infrastructure
 */
function validateCatalogStructure(data: unknown, catalogName: string): void {
  if (!data || typeof data !== 'object') {
    throw FoundryCatalogError.invalidSchema(catalogName, 'Catalog must be an object');
  }

  const dataObj = data as Record<string, unknown>;

  if (!dataObj.version || typeof dataObj.version !== 'string') {
    throw FoundryCatalogError.invalidSchema(catalogName, 'Catalog must have a version string');
  }

  // Catalog-specific validation
  switch (catalogName) {
    case 'patterns':
      if (!Array.isArray(dataObj.patterns)) {
        throw FoundryCatalogError.invalidSchema(
          catalogName,
          'Patterns catalog must have patterns array',
        );
      }
      break;
    case 'httpStatuses':
      if (!Array.isArray(dataObj.groups)) {
        throw FoundryCatalogError.invalidSchema(
          catalogName,
          'HTTP statuses catalog must have groups array',
        );
      }
      break;
    case 'mimeTypes':
      if (!Array.isArray(dataObj.types)) {
        throw FoundryCatalogError.invalidSchema(
          catalogName,
          'MIME types catalog must have types array',
        );
      }
      break;
    case 'countryCodes':
      if (!Array.isArray(dataObj.countries)) {
        throw FoundryCatalogError.invalidSchema(
          catalogName,
          'Country codes catalog must have countries array',
        );
      }
      break;
  }
}

/**
 * Load Pattern Catalog from SSOT
 */
export async function loadPatternCatalog(): Promise<PatternCatalog> {
  return loadCatalog<PatternCatalog>(SSOT_PATHS.patterns, 'patterns');
}

/**
 * Load HTTP Status Catalog from SSOT
 */
export async function loadHttpStatusCatalog(): Promise<HttpStatusCatalog> {
  return loadCatalog<HttpStatusCatalog>(SSOT_PATHS.httpStatuses, 'httpStatuses');
}

/**
 * Load MIME Type Catalog from SSOT
 */
export async function loadMimeTypeCatalog(): Promise<MimeTypeCatalog> {
  return loadCatalog<MimeTypeCatalog>(SSOT_PATHS.mimeTypes, 'mimeTypes');
}

/**
 * Load Country Code Catalog from SSOT
 */
export async function loadCountryCodeCatalog(): Promise<CountryCatalog> {
  return loadCatalog<CountryCatalog>(SSOT_PATHS.countryCodes, 'countryCodes');
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
