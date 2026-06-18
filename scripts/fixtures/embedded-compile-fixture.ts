/**
 * Compiled-binary embedded-asset STATIC proof fixture (v0.4.0 T3). NOT shipped.
 *
 * Compiled by `scripts/verify-embedded-compile.ts` via `bun build --compile`
 * and run from a temp cwd with no asset tree on disk. Proves that SSOT assets
 * resolve from the statically-registered generated manifests inside a single-file
 * binary. The COLD lazy-import proof lives in `embedded-lazy-fixture.ts` (kept
 * separate so the lazy-probed domain is not in this fixture's static graph).
 */

import { registerAllEmbeddedAssets } from "../../src/assets/generated/index.js";
import { resolveAssets } from "../../src/assets/index.js";

async function main(): Promise<void> {
  registerAllEmbeddedAssets();
  const resolver = resolveAssets({ mode: "embedded" });

  // 1. metaschema (config validation depends on this in T4)
  const meta = JSON.parse(await resolver.read("schemas/crucible-ts/meta/draft-07/schema.json"));
  if (typeof meta.$schema !== "string") throw new Error("metaschema read failed");

  // 2. foundry signals catalog (the `serve` blocker, T5)
  const sig = await resolver.read("config/crucible-ts/library/foundry/signals.yaml");
  if (!sig.includes("signals")) throw new Error("signals read failed");

  // 3. enumerate schemas without a filesystem walk (registry de-glob, T4)
  const schemas = await resolver.list(["schemas/crucible-ts/**/*.schema.{json,yaml,yml}"]);
  if (schemas.length < 100) throw new Error(`schema list too small: ${schemas.length}`);

  // 4. cross-tree asset present (schema $ref → config taxonomy, T1 site D)
  if (!(await resolver.has("config/crucible-ts/taxonomy/metrics.yaml"))) {
    throw new Error("cross-tree taxonomy asset missing");
  }

  console.log(
    `STATIC_EMBED_OK count=${resolver.provenance().embeddedCount} schemas=${schemas.length}`,
  );
}

main().catch((error) => {
  console.error("FAIL", error);
  process.exit(1);
});
