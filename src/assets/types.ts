/**
 * Asset resolution - Types
 *
 * Central contract for resolving tsfulmen's bundled SSOT assets (schemas,
 * metaschemas, foundry catalogs, taxonomy) either from the filesystem (npm /
 * `node dist` / source) or from embedded generated modules (a `bun --compile`
 * single-file binary, where no asset tree exists on disk).
 *
 * Logical paths are **package-root-relative POSIX paths**, e.g.
 * `schemas/crucible-ts/library/foundry/v1.0.0/signals.schema.json` or
 * `config/crucible-ts/library/foundry/signals.yaml`. Using a single namespace
 * across both the `schemas/` and `config/` trees lets cross-tree `$ref`
 * resolution (e.g. a schema referencing `config/.../taxonomy/metrics.yaml`)
 * work through one resolver.
 */

/**
 * How assets are resolved.
 * - `fs`: read from the on-disk asset trees (current behavior).
 * - `embedded`: read from generated, build-embedded manifests (compile-safe).
 * - `auto`: prefer `fs` when the asset tree is present/readable, else `embedded`.
 */
export type AssetMode = "fs" | "embedded" | "auto";

/**
 * Provenance/metadata for diagnostics and parity reporting across SDKs.
 */
export interface AssetProvenance {
  /** The concrete resolution mode in effect (never `auto`). */
  readonly mode: Exclude<AssetMode, "auto">;
  /** On-disk base directory, when resolving from the filesystem. */
  readonly baseDir?: string;
  /** Number of embedded assets available, when resolving from embedded modules. */
  readonly embeddedCount?: number;
}

/**
 * Resolves SSOT assets by logical path, independent of backing store.
 */
export interface AssetResolver {
  /** Concrete resolution mode (`fs` or `embedded`). */
  readonly mode: Exclude<AssetMode, "auto">;

  /**
   * Read an asset's text content by logical path.
   * @throws {AssetResolutionError} when the asset cannot be found/read.
   */
  read(logicalPath: string): Promise<string>;

  /**
   * Enumerate logical paths matching the given glob patterns (e.g.
   * `["schemas/crucible-ts/** /*.schema.json"]`). Powers schema-registry
   * discovery without a filesystem walk.
   */
  list(patterns: string[]): Promise<string[]>;

  /** Whether an asset exists at the given logical path. */
  has(logicalPath: string): Promise<boolean>;

  /** Provenance for diagnostics / size & parity reporting. */
  provenance(): AssetProvenance;
}

/**
 * A generated, build-embedded set of assets for one domain (e.g. metaschemas,
 * foundry catalogs). T3 codegen emits these; {@link registerEmbeddedAssets}
 * composes them into the embedded resolver.
 */
export interface EmbeddedAssetManifest {
  /** Domain label for diagnostics (e.g. `"foundry"`, `"metaschema"`). */
  readonly domain: string;
  /** Logical path -> raw text content. */
  readonly files: Readonly<Record<string, string>>;
}
