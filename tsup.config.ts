import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "appidentity/index": "src/appidentity/index.ts",
    "assets/index": "src/assets/index.ts",
    "config/index": "src/config/index.ts",
    "crucible/index": "src/crucible/index.ts",
    "crucible/fulpack/index": "src/crucible/fulpack/index.ts",
    "docscribe/index": "src/docscribe/index.ts",
    "errors/index": "src/errors/index.ts",
    "foundry/index": "src/foundry/index.ts",
    "foundry/similarity/index": "src/foundry/similarity/index.ts",
    "fulhash/index": "src/fulhash/index.ts",
    "fulencode/index": "src/fulencode/index.ts",
    "fulpack/index": "src/fulpack/index.ts",
    "logging/index": "src/logging/index.ts",
    "pathfinder/index": "src/pathfinder/index.ts",
    "schema/index": "src/schema/index.ts",
    "telemetry/index": "src/telemetry/index.ts",
    "telemetry/http/index": "src/telemetry/http/index.ts",
    "telemetry/prometheus/index": "src/telemetry/prometheus/index.ts",
    "signals/index": "src/signals/index.ts",
    "similarity/index": "src/similarity/index.ts",
    // Executable CLI entry points (package `bin`). These are intentionally NOT
    // package `exports` — they are runnable commands kept out of the importable
    // library graph so they cannot self-execute and shadow a consumer's program
    // under `bun build --compile`. The validate-tsup check skips `bin/*` entries.
    "bin/schema-cli": "src/bin/schema-cli.ts",
    "bin/signals-cli": "src/bin/signals-cli.ts",
    "bin/prometheus-cli": "src/bin/prometheus-cli.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  outDir: "dist",
});
