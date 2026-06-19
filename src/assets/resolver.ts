/**
 * Asset resolution - Resolver factory & mode selection
 *
 * Chooses between the filesystem and embedded backends. Default is `auto`:
 * prefer the filesystem when the on-disk asset tree is present/readable, else
 * fall back to embedded generated modules (the `bun --compile` case). The mode
 * can be forced with the `TSFULMEN_ASSET_MODE` env var or an explicit option.
 */

import { accessSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EmbeddedAssetResolver,
  getRegistrationVersion,
  hasEmbeddedAssets,
  hasEmbeddedDomain,
  registerEmbeddedAssets,
} from "./embedded-resolver.js";
import { AssetResolutionError } from "./errors.js";
import { FsAssetResolver } from "./fs-resolver.js";
import type { AssetMode, AssetResolver } from "./types.js";

/**
 * Marker that identifies the package-root asset tree. Used both to locate the
 * base dir by walking upward and to test FS availability for `auto` selection.
 */
const ASSET_ROOT_MARKER = join("schemas", "crucible-ts");

function dirExists(path: string): boolean {
  try {
    accessSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the package-root directory that contains the SSOT asset trees by walking
 * upward from this module. Works for both source (`src/assets/`) and bundled
 * (`dist/`) layouts without hard-coded depths — and returns `null` inside a
 * `bun --compile` binary where no such directory exists on disk.
 */
export function findAssetBaseDir(): string | null {
  let dir: string;
  try {
    dir = dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }

  // Walk up to the filesystem root looking for the asset-root marker.
  let prev = "";
  while (dir !== prev) {
    if (dirExists(join(dir, ASSET_ROOT_MARKER))) {
      return dir;
    }
    prev = dir;
    dir = dirname(dir);
  }
  return null;
}

function readModeFromEnv(): AssetMode | undefined {
  const raw = process.env.TSFULMEN_ASSET_MODE?.trim().toLowerCase();
  if (raw === "fs" || raw === "embedded" || raw === "auto") {
    return raw;
  }
  return undefined;
}

export interface ResolveAssetsOptions {
  /** Force a mode. Precedence: explicit option > `TSFULMEN_ASSET_MODE` > `auto`. */
  mode?: AssetMode;
  /** Override the FS base dir (e.g. a consumer's own asset tree). Implies `fs`. */
  baseDir?: string;
}

/**
 * Build an {@link AssetResolver} for the requested (or auto-detected) mode.
 * Stateless — callers that want a cached instance use {@link getAssetResolver}.
 */
export function resolveAssets(options: ResolveAssetsOptions = {}): AssetResolver {
  if (options.baseDir) {
    // Consumer-supplied tree: they scope it, so don't impose the SSOT namespace
    // (traversal guards still apply). Used by e.g. a custom schema-registry baseDir.
    return new FsAssetResolver(options.baseDir, false);
  }

  const requested: AssetMode = options.mode ?? readModeFromEnv() ?? "auto";

  if (requested === "fs") {
    const baseDir = findAssetBaseDir();
    if (!baseDir) {
      throw AssetResolutionError.baseDirUnavailable(
        "mode=fs but no on-disk asset tree found (use mode=embedded in a compiled binary)",
      );
    }
    return new FsAssetResolver(baseDir);
  }

  if (requested === "embedded") {
    return new EmbeddedAssetResolver();
  }

  // auto: prefer FS when the asset tree is present, else embedded.
  const baseDir = findAssetBaseDir();
  if (baseDir) {
    return new FsAssetResolver(baseDir);
  }
  if (hasEmbeddedAssets()) {
    return new EmbeddedAssetResolver();
  }
  throw AssetResolutionError.baseDirUnavailable(
    "auto: no on-disk asset tree and no embedded assets registered",
  );
}

let cached: AssetResolver | undefined;
let cachedKey: string | undefined;

/**
 * Cached resolver keyed on the effective options. Most call sites should use
 * this; pass fresh options (or different env) to rebuild.
 */
export function getAssetResolver(options: ResolveAssetsOptions = {}): AssetResolver {
  const key = JSON.stringify({
    mode: options.mode ?? readModeFromEnv() ?? "auto",
    baseDir: options.baseDir ?? null,
    // Fold in the registration version so a cached embedded resolver rebuilds
    // after a domain is registered (e.g. via ensureEmbeddedDomain).
    reg: getRegistrationVersion(),
  });
  if (!cached || cachedKey !== key) {
    cached = resolveAssets(options);
    cachedKey = key;
  }
  return cached;
}

/** Reset the cached resolver. For testing / after registering embedded assets. */
export function resetAssetResolver(): void {
  cached = undefined;
  cachedKey = undefined;
}

/**
 * Ensure an embedded domain's assets are registered, lazily importing its
 * generated manifest on first use. No-op if already registered (or if running
 * with a filesystem asset tree, where embedded assets aren't needed). Used by
 * load sites (schema registry, validator, foundry) so a `bun --compile` binary
 * pulls only the domains it actually touches.
 *
 * Dynamically imports the generated loader map so this module carries no static
 * dependency on the (large) generated domain modules.
 */
export async function ensureEmbeddedDomain(domain: string): Promise<void> {
  if (hasEmbeddedDomain(domain)) {
    return;
  }
  const { domainLoaders } = await import("./generated/loaders.generated.js");
  const loader = domainLoaders[domain as keyof typeof domainLoaders];
  if (!loader) {
    throw new AssetResolutionError(`Unknown embedded asset domain: ${domain}`);
  }
  const mod = await loader();
  registerEmbeddedAssets(mod.manifest);
  // Cache auto-invalidates via the registration version in getAssetResolver's key.
}
