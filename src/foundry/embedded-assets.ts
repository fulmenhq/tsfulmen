/**
 * Static per-subpath embedded-asset registration for the foundry subpath (v0.4.0).
 *
 * Registers only the `foundry` domain (catalogs) by importing its per-domain
 * generated module directly (not `generated/index`). Note: the foundry subpath
 * still transitively reaches the schema corpus via `validateDataBySchemaId`; under
 * tsup `splitting:true` that corpus lives once in a shared chunk (deduped), so the
 * invariant is "public entries stay lean; corpus lives once in shared chunks" — not
 * "foundry never references the schema corpus". Unused in filesystem mode; required
 * for foundry catalog loading inside a `bun --compile` binary.
 */

import { manifest as foundryManifest } from "../assets/generated/foundry.generated.js";
import { registerEmbeddedAssets } from "../assets/index.js";

let registered = false;

/** Register the foundry catalog domain (idempotent). */
export function ensureFoundryAssetsRegistered(): void {
  if (registered) {
    return;
  }
  registerEmbeddedAssets(foundryManifest);
  registered = true;
}
