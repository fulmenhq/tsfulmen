/**
 * Asset resolution module
 *
 * Resolves tsfulmen's bundled SSOT assets (schemas, metaschemas, foundry
 * catalogs, taxonomy) from the filesystem or from build-embedded generated
 * modules — the latter making loads work inside a `bun --compile` single-file
 * binary. See `planning/tsfulmen/v040-shaping.md`.
 */

export {
  clearEmbeddedAssets,
  EmbeddedAssetResolver,
  hasEmbeddedAssets,
  hasEmbeddedDomain,
  registerEmbeddedAssets,
} from "./embedded-resolver.js";
export { AssetResolutionError } from "./errors.js";
export { FsAssetResolver } from "./fs-resolver.js";
export {
  findAssetBaseDir,
  getAssetResolver,
  type ResolveAssetsOptions,
  resetAssetResolver,
  resolveAssets,
} from "./resolver.js";
export type {
  AssetMode,
  AssetProvenance,
  AssetResolver,
  EmbeddedAssetManifest,
} from "./types.js";
