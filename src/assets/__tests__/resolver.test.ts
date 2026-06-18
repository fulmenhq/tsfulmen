/**
 * AssetResolver foundation tests (v0.4.0 T2)
 *
 * Covers the FS backend against the real on-disk asset trees, the embedded
 * backend + manifest registry, and factory mode selection (`fs`/`embedded`/
 * `auto` + TSFULMEN_ASSET_MODE). No load site is repointed yet (T4/T5), so
 * these exercise the resolver in isolation.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearEmbeddedAssets,
  EmbeddedAssetResolver,
  hasEmbeddedAssets,
  registerEmbeddedAssets,
} from "../embedded-resolver.js";
import { AssetResolutionError } from "../errors.js";
import { FsAssetResolver } from "../fs-resolver.js";
import {
  findAssetBaseDir,
  getAssetResolver,
  resetAssetResolver,
  resolveAssets,
} from "../resolver.js";

const SIGNALS_CATALOG = "config/crucible-ts/library/foundry/signals.yaml";
const SIGNALS_SCHEMA_GLOB = "schemas/crucible-ts/**/signals.schema.json";

describe("findAssetBaseDir", () => {
  it("locates a package root containing schemas/crucible-ts", () => {
    const base = findAssetBaseDir();
    expect(base).not.toBeNull();
  });
});

describe("FsAssetResolver", () => {
  let resolver: FsAssetResolver;

  beforeEach(() => {
    const base = findAssetBaseDir();
    if (!base) throw new Error("asset base dir not found in test environment");
    resolver = new FsAssetResolver(base);
  });

  it("reads a real config asset by logical path", async () => {
    const content = await resolver.read(SIGNALS_CATALOG);
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("signals");
  });

  it("has() is true for an existing asset, false otherwise", async () => {
    expect(await resolver.has(SIGNALS_CATALOG)).toBe(true);
    expect(await resolver.has("config/crucible-ts/does-not-exist.yaml")).toBe(false);
  });

  it("throws AssetResolutionError (not found) for a missing asset", async () => {
    await expect(resolver.read("schemas/crucible-ts/nope.schema.json")).rejects.toBeInstanceOf(
      AssetResolutionError,
    );
  });

  it("list() enumerates by glob and returns relative POSIX paths, sorted", async () => {
    const matches = await resolver.list([SIGNALS_SCHEMA_GLOB]);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(m.startsWith("schemas/crucible-ts/")).toBe(true);
      expect(m.includes("\\")).toBe(false);
    }
    expect([...matches]).toEqual([...matches].sort());
  });

  it("list() of the full schema set is non-trivial (registry discovery parity surface)", async () => {
    const all = await resolver.list(["schemas/crucible-ts/**/*.schema.{json,yaml,yml}"]);
    expect(all.length).toBeGreaterThan(100);
  });

  it("provenance reports fs + baseDir", () => {
    const p = resolver.provenance();
    expect(p.mode).toBe("fs");
    expect(p.baseDir).toBeTruthy();
  });
});

describe("EmbeddedAssetResolver + registry", () => {
  afterEach(() => {
    clearEmbeddedAssets();
  });

  it("is empty until manifests are registered", async () => {
    expect(hasEmbeddedAssets()).toBe(false);
    const resolver = new EmbeddedAssetResolver();
    expect(resolver.provenance().embeddedCount).toBe(0);
    await expect(resolver.read("anything")).rejects.toBeInstanceOf(AssetResolutionError);
    expect(await resolver.list(["**/*"])).toEqual([]);
  });

  it("reads, has, and globs registered embedded assets", async () => {
    registerEmbeddedAssets({
      domain: "test",
      files: {
        "config/crucible-ts/library/foundry/signals.yaml": "signals: []\n",
        "schemas/crucible-ts/library/foundry/v1.0.0/signals.schema.json": "{}",
      },
    });
    const resolver = new EmbeddedAssetResolver();

    expect(hasEmbeddedAssets()).toBe(true);
    expect(await resolver.read(SIGNALS_CATALOG)).toContain("signals");
    expect(await resolver.has(SIGNALS_CATALOG)).toBe(true);
    expect(await resolver.list(["schemas/crucible-ts/**/*.schema.json"])).toEqual([
      "schemas/crucible-ts/library/foundry/v1.0.0/signals.schema.json",
    ]);
    expect(resolver.provenance().embeddedCount).toBe(2);
  });

  it("replaces a domain on re-registration (idempotent per domain)", async () => {
    registerEmbeddedAssets({ domain: "d", files: { "a.yaml": "1" } });
    registerEmbeddedAssets({ domain: "d", files: { "b.yaml": "2" } });
    const resolver = new EmbeddedAssetResolver();
    expect(await resolver.has("a.yaml")).toBe(false);
    expect(await resolver.has("b.yaml")).toBe(true);
  });
});

describe("resolveAssets / mode selection", () => {
  afterEach(() => {
    clearEmbeddedAssets();
    resetAssetResolver();
    delete process.env.TSFULMEN_ASSET_MODE;
  });

  it("auto prefers fs when the asset tree is present", () => {
    const resolver = resolveAssets({ mode: "auto" });
    expect(resolver.mode).toBe("fs");
  });

  it("explicit embedded returns the embedded resolver", () => {
    const resolver = resolveAssets({ mode: "embedded" });
    expect(resolver.mode).toBe("embedded");
  });

  it("reads mode from TSFULMEN_ASSET_MODE", () => {
    process.env.TSFULMEN_ASSET_MODE = "embedded";
    expect(resolveAssets().mode).toBe("embedded");
  });

  it("explicit baseDir forces an fs resolver at that dir", () => {
    const base = findAssetBaseDir();
    if (!base) throw new Error("no base");
    const resolver = resolveAssets({ baseDir: base });
    expect(resolver.mode).toBe("fs");
    expect((resolver as FsAssetResolver).getBaseDir()).toBe(base);
  });

  it("getAssetResolver caches per effective key and rebuilds on change", () => {
    const a = getAssetResolver({ mode: "fs" });
    const b = getAssetResolver({ mode: "fs" });
    expect(a).toBe(b);
    const c = getAssetResolver({ mode: "embedded" });
    expect(c).not.toBe(a);
  });
});
