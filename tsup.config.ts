import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "appidentity/index": "src/appidentity/index.ts",
    "config/index": "src/config/index.ts",
    "crucible/index": "src/crucible/index.ts",
    "docscribe/index": "src/docscribe/index.ts",
    "errors/index": "src/errors/index.ts",
    "foundry/index": "src/foundry/index.ts",
    "foundry/similarity/index": "src/foundry/similarity/index.ts",
    "fulhash/index": "src/fulhash/index.ts",
    "fulpack/index": "src/fulpack/index.ts",
    "logging/index": "src/logging/index.ts",
    "pathfinder/index": "src/pathfinder/index.ts",
    "schema/index": "src/schema/index.ts",
    "telemetry/index": "src/telemetry/index.ts",
    "telemetry/http/index": "src/telemetry/http/index.ts",
    "telemetry/prometheus/index": "src/telemetry/prometheus/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  outDir: "dist",
});
