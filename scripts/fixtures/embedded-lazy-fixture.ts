/**
 * Compiled-binary COLD lazy-import proof fixture (v0.4.0 T3). NOT shipped.
 *
 * De-confounded lazy proof (devrev): this fixture does NOT statically import
 * `generated/index` or any `*.generated` module. The `taxonomy` domain module is
 * reachable ONLY through the string-literal dynamic `import()` below, so a
 * successful read in the compiled binary proves that a cold/lazy-only domain
 * survives `bun build --compile` — i.e. per-domain lazy split is genuinely viable.
 */

import {
  EmbeddedAssetResolver,
  registerEmbeddedAssets,
} from "../../src/assets/embedded-resolver.js";

async function main(): Promise<void> {
  // taxonomy.generated is NOT statically referenced anywhere in this fixture.
  const mod = await import("../../src/assets/generated/taxonomy.generated.js");
  registerEmbeddedAssets(mod.manifest);

  const resolver = new EmbeddedAssetResolver();
  const metrics = await resolver.read("config/crucible-ts/taxonomy/metrics.yaml");
  const ok = mod.manifest.domain === "taxonomy" && metrics.length > 0;
  console.log(`LAZY_COLD_OK=${ok} domain=${mod.manifest.domain} bytes=${metrics.length}`);
}

main().catch((error) => {
  console.log(`LAZY_COLD_OK=false err=${(error as Error).message}`);
  process.exit(1);
});
