/**
 * Asset resolution - Embedded backend
 *
 * Reads SSOT assets from generated, build-embedded manifests instead of the
 * filesystem, so loads work inside a `bun --compile` single-file binary (no
 * asset tree on disk). T3 codegen emits per-domain {@link EmbeddedAssetManifest}
 * modules and registers them via {@link registerEmbeddedAssets}; this resolver
 * composes whatever has been registered.
 *
 * Until T3 lands, no manifests are registered, so the embedded resolver is
 * empty — `read()` throws a clear "not found" and `list()` returns `[]`.
 */

import picomatch from "picomatch";
import { AssetResolutionError } from "./errors.js";
import type { AssetProvenance, AssetResolver, EmbeddedAssetManifest } from "./types.js";

/** Process-level registry of embedded asset manifests (composed by domain). */
const registeredManifests: EmbeddedAssetManifest[] = [];

/**
 * Register a generated embedded-asset manifest. Idempotent per domain
 * (re-registering a domain replaces it). Called by T3-generated modules.
 */
export function registerEmbeddedAssets(manifest: EmbeddedAssetManifest): void {
  const existing = registeredManifests.findIndex((m) => m.domain === manifest.domain);
  if (existing >= 0) {
    registeredManifests[existing] = manifest;
  } else {
    registeredManifests.push(manifest);
  }
}

/** Clear all registered manifests. For testing only. */
export function clearEmbeddedAssets(): void {
  registeredManifests.length = 0;
}

/** Whether any embedded manifests have been registered. */
export function hasEmbeddedAssets(): boolean {
  return registeredManifests.length > 0;
}

/** Flatten registered manifests into a single logical-path -> content map. */
function buildIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const manifest of registeredManifests) {
    for (const [logicalPath, content] of Object.entries(manifest.files)) {
      index.set(logicalPath, content);
    }
  }
  return index;
}

export class EmbeddedAssetResolver implements AssetResolver {
  readonly mode = "embedded" as const;

  // Snapshot the index at construction; resolvers are cheap to recreate and the
  // factory rebuilds when mode changes.
  private readonly index: Map<string, string>;

  constructor() {
    this.index = buildIndex();
  }

  async read(logicalPath: string): Promise<string> {
    const content = this.index.get(logicalPath);
    if (content === undefined) {
      throw AssetResolutionError.notFound(logicalPath, "embedded");
    }
    return content;
  }

  async list(patterns: string[]): Promise<string[]> {
    if (patterns.length === 0) {
      return [];
    }
    const isMatch = picomatch(patterns, { dot: false });
    return Array.from(this.index.keys())
      .filter((key) => isMatch(key))
      .sort();
  }

  async has(logicalPath: string): Promise<boolean> {
    return this.index.has(logicalPath);
  }

  provenance(): AssetProvenance {
    return { mode: "embedded", embeddedCount: this.index.size };
  }
}
