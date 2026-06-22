/**
 * Static per-subpath embedded-asset registration for the schema subpath (v0.4.0).
 *
 * The `./assets` core deliberately carries no SSOT corpus (so its dist entry stays
 * lean). Instead each feature subpath statically registers only the domains it
 * needs — here, the metaschemas/vocab, the schema corpus, and the taxonomy that
 * schemas `$ref` cross-tree. Importing only the per-domain generated modules (not
 * `generated/index`) keeps `foundry` out of the schema subpath's bundle.
 *
 * In filesystem mode (npm / `node dist` / source) the resolver reads the on-disk
 * trees and these registrations are simply unused; in a `bun --compile` binary
 * they are what makes schema discovery + validation work without a filesystem.
 */

import { manifest as metaschemaManifest } from "../assets/generated/metaschema.generated.js";
import { manifest as schemasManifest } from "../assets/generated/schemas.generated.js";
import { manifest as taxonomyManifest } from "../assets/generated/taxonomy.generated.js";
import { registerEmbeddedAssets } from "../assets/index.js";

let registered = false;

/**
 * Register the schema subpath's embedded asset domains (idempotent). Called by
 * the registry/validator before resolving assets, so embedded mode has them.
 */
export function ensureSchemaAssetsRegistered(): void {
  if (registered) {
    return;
  }
  registerEmbeddedAssets(metaschemaManifest);
  registerEmbeddedAssets(schemasManifest);
  registerEmbeddedAssets(taxonomyManifest);
  registered = true;
}
