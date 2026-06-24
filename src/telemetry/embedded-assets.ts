/**
 * Static per-subpath embedded-asset registration for the telemetry subpath (v0.4.0).
 *
 * Registers only the `taxonomy` domain (metrics taxonomy). Unused in filesystem
 * mode; required for metrics-taxonomy loading inside a `bun --compile` binary.
 */

import { manifest as taxonomyManifest } from "../assets/generated/taxonomy.generated.js";
import { registerEmbeddedAssets } from "../assets/index.js";

let registered = false;

/** Register the telemetry taxonomy domain (idempotent). */
export function ensureTelemetryAssetsRegistered(): void {
  if (registered) {
    return;
  }
  registerEmbeddedAssets(taxonomyManifest);
  registered = true;
}
