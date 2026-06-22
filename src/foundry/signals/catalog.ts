/**
 * Signal Catalog Loader
 *
 * Loads and validates the signal handling catalog from Crucible SSOT assets
 * following the same pattern as other Foundry catalogs.
 */

import { parse as parseYaml } from "yaml";
import { getAssetResolver } from "../../assets/index.js";
import { validateDataBySchemaId } from "../../schema/validator.js";
import { ensureFoundryAssetsRegistered } from "../embedded-assets.js";
import { FoundryCatalogError } from "../errors.js";
import type { BehaviorInfo, SignalCatalog, SignalInfo } from "./types.js";

// SSOT asset logical path (resolved via the AssetResolver — filesystem or embedded).
const SIGNALS_LOGICAL_PATH = "config/crucible-ts/library/foundry/signals.yaml";

// Schema ID for signals catalog (from Crucible SSOT)
const SCHEMA_ID = "library/foundry/v1.0.0/signals";

/**
 * Load and validate the Signal Catalog from SSOT (filesystem or embedded).
 */
async function loadCatalog(): Promise<SignalCatalog> {
  const catalogName = "signals";

  try {
    ensureFoundryAssetsRegistered();
    const resolver = getAssetResolver();

    let content: string;
    try {
      content = await resolver.read(SIGNALS_LOGICAL_PATH);
    } catch {
      throw FoundryCatalogError.missingCatalog(catalogName);
    }

    // Parse YAML content
    const data = parseYaml(content) as SignalCatalog;

    // Validate against JSON Schema from Crucible SSOT
    const result = await validateDataBySchemaId(data, SCHEMA_ID);
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
