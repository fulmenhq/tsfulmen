/**
 * Static per-subpath embedded-asset registration for the foundry subpath (v0.4.0).
 *
 * Registers only the `foundry` domain (catalogs) — importing the per-domain
 * generated module directly keeps the schema corpus out of foundry-only consumers.
 * Unused in filesystem mode; required for foundry catalog loading inside a
 * `bun --compile` binary.
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
