/**
 * Signal Catalog Loader
 *
 * Loads and validates the signal handling catalog from Crucible SSOT assets
 * following the same pattern as other Foundry catalogs.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { validateDataBySchemaId } from '../../schema/validator.js';
import { FoundryCatalogError } from '../errors.js';
import type { BehaviorInfo, SignalCatalog, SignalInfo } from './types.js';

// Get the directory of the current module file for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SSOT Asset Paths (relative to module file, resolved to absolute paths)
const SSOT_PATHS = {
  signals: join(__dirname, '../../../config/crucible-ts/library/foundry/signals.yaml'),
} as const;

// Schema ID for signals catalog (from Crucible SSOT)
const SCHEMA_ID = 'library/foundry/v1.0.0/signals';

/**
 * Load and validate the Signal Catalog from SSOT
 * Bun-first approach with Node.js fallback
 */
async function loadCatalog(): Promise<SignalCatalog> {
  const filePath = SSOT_PATHS.signals;
  const catalogName = 'signals';

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
    const data = parseYaml(content) as SignalCatalog;

    // Validate against JSON Schema from Crucible SSOT
    const result = await validateDataBySchemaId(data, SCHEMA_ID);
    if (!result.valid) {
      const errorMessages = result.diagnostics.map((d) => `${d.pointer}: ${d.message}`).join('; ');
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

// Cached catalog instance
let cachedCatalog: SignalCatalog | null = null;

/**
 * Get the signal catalog, loading it if necessary
 */
async function getCatalog(): Promise<SignalCatalog> {
  if (!cachedCatalog) {
    cachedCatalog = await loadCatalog();
  }
  return cachedCatalog;
}

/**
 * Get the signals catalog version
 */
export async function getSignalsVersion(): Promise<string> {
  const catalog = await getCatalog();
  return catalog.version;
}

/**
 * Get all signals
 */
export async function listSignals(): Promise<SignalInfo[]> {
  const catalog = await getCatalog();
  return catalog.signals.map((signal) => ({ ...signal }));
}

/**
 * Get a specific signal by ID or name
 */
export async function getSignal(identifier: string): Promise<SignalInfo | null> {
  const catalog = await getCatalog();
  const signal = catalog.signals.find((s) => s.id === identifier || s.name === identifier);
  return signal ? { ...signal } : null;
}

/**
 * Get all behaviors
 */
export async function listBehaviors(): Promise<BehaviorInfo[]> {
  const catalog = await getCatalog();
  return catalog.behaviors.map((behavior) => ({ ...behavior }));
}

/**
 * Get a specific behavior by ID
 */
export async function getBehavior(id: string): Promise<BehaviorInfo | null> {
  const catalog = await getCatalog();
  const behavior = catalog.behaviors.find((b) => b.id === id);
  return behavior ? { ...behavior } : null;
}

/**
 * Get the complete catalog (for advanced use cases)
 */
export async function getSignalCatalog(): Promise<SignalCatalog> {
  return await getCatalog();
}
