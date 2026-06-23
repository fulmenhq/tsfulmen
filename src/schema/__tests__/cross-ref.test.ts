/**
 * Cross-schema $ref resolution through the AssetResolver (v0.4.0 T4b).
 *
 * Guards the relative/cross-tree $ref classes devrev flagged, now resolvable
 * after crucible v0.4.15 fixed the $id/layout inconsistencies:
 *   - same-directory ref    (log-event → definitions.schema.json)
 *   - parent / cross-namespace ref (module-manifest → ../../../taxonomy/...)
 *   - cross-tree config ref (metrics-event → config/.../taxonomy/metrics.yaml)
 * Validates resolution via the public compileSchemaById in both filesystem and
 * embedded asset modes.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearEmbeddedAssets, resetAssetResolver } from "../../assets/index.js";
import { clearCache, compileSchemaById } from "../validator.js";

const CASES = [
  { label: "same-directory ref", id: "observability/logging/v1.0.0/log-event" },
  { label: "parent / cross-namespace ref", id: "library/module-manifest/v1.0.0/module-manifest" },
  { label: "cross-tree config/taxonomy ref", id: "observability/metrics/v1.0.0/metrics-event" },
];

describe("cross-schema $ref resolution (filesystem mode)", () => {
  afterEach(() => {
    clearCache();
  });

  for (const { label, id } of CASES) {
    it(`resolves ${label}: ${id}`, async () => {
      const validator = await compileSchemaById(id);
      expect(typeof validator).toBe("function");
    });
  }
});

describe("cross-schema $ref resolution (embedded mode)", () => {
  beforeEach(() => {
    process.env.TSFULMEN_ASSET_MODE = "embedded";
    resetAssetResolver();
    clearCache();
  });

  afterEach(() => {
    delete process.env.TSFULMEN_ASSET_MODE;
    resetAssetResolver();
    clearEmbeddedAssets();
    clearCache();
  });

  it("resolves a same-directory ref from embedded assets (compiled-binary path)", async () => {
    const validator = await compileSchemaById("observability/logging/v1.0.0/log-event");
    expect(typeof validator).toBe("function");
  });

  it("resolves a cross-tree config/taxonomy ref from embedded assets", async () => {
    const validator = await compileSchemaById("observability/metrics/v1.0.0/metrics-event");
    expect(typeof validator).toBe("function");
  });
});
