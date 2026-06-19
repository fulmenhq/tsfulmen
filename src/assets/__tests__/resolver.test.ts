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
    await expect(resolver.read("schemas/crucible-ts/nope.json")).rejects.toBeInstanceOf(
      AssetResolutionError,
    );
    expect(await resolver.list(["schemas/crucible-ts/**/*"])).toEqual([]);
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
    registerEmbeddedAssets({ domain: "d", files: { "config/crucible-ts/a.yaml": "1" } });
    registerEmbeddedAssets({ domain: "d", files: { "config/crucible-ts/b.yaml": "2" } });
    const resolver = new EmbeddedAssetResolver();
    expect(await resolver.has("config/crucible-ts/a.yaml")).toBe(false);
    expect(await resolver.has("config/crucible-ts/b.yaml")).toBe(true);
  });
});

describe("path-traversal & namespace validation (public ./assets surface)", () => {
  const base = findAssetBaseDir();
  const fs = new FsAssetResolver(base ?? ".");
  const emb = new EmbeddedAssetResolver();

  const badPaths = [
    "../AGENTS.md",
    "schemas/crucible-ts/../../AGENTS.md",
    "/etc/passwd",
    "schemas\\crucible-ts\\x.json",
    "package.json", // valid relative but outside the asset namespace
    "",
  ];

  for (const bad of badPaths) {
    it(`fs.read rejects unsafe path: ${JSON.stringify(bad)}`, async () => {
      await expect(fs.read(bad)).rejects.toBeInstanceOf(AssetResolutionError);
    });
    it(`fs.has returns false for unsafe path: ${JSON.stringify(bad)}`, async () => {
      expect(await fs.has(bad)).toBe(false);
    });
    it(`embedded.read rejects unsafe path: ${JSON.stringify(bad)}`, async () => {
      await expect(emb.read(bad)).rejects.toBeInstanceOf(AssetResolutionError);
    });
  }

  it("fs.has('../AGENTS.md') is false (was the reported traversal escape)", async () => {
    expect(await fs.has("../AGENTS.md")).toBe(false);
  });

  it("list() rejects traversal/namespace-escaping patterns", async () => {
    await expect(fs.list(["../**"])).rejects.toBeInstanceOf(AssetResolutionError);
    await expect(fs.list(["**/*"])).rejects.toBeInstanceOf(AssetResolutionError);
    await expect(emb.list(["../../**"])).rejects.toBeInstanceOf(AssetResolutionError);
  });

  // secrev #4: brace-expansion bypass class held safe by NS check + fast-glob cwd.
  it("rejects brace-expansion traversal/namespace bypass patterns", async () => {
    await expect(fs.list(["schemas/{..,crucible-ts}/../package.json"])).rejects.toBeInstanceOf(
      AssetResolutionError,
    );
    await expect(fs.read("schemas/{..,crucible-ts}/../package.json")).rejects.toBeInstanceOf(
      AssetResolutionError,
    );
    await expect(fs.list(["{schemas,..}/**"])).rejects.toBeInstanceOf(AssetResolutionError);
  });

  it("still allows legitimate namespaced paths/patterns", async () => {
    expect(await fs.has("config/crucible-ts/library/foundry/signals.yaml")).toBe(true);
    const list = await fs.list(["schemas/crucible-ts/**/*.schema.json"]);
    expect(list.length).toBeGreaterThan(0);
  });

  it("consumer baseDir override relaxes namespace but keeps traversal guards", async () => {
    if (!base) throw new Error("no base");
    // enforceNamespace=false: non-namespaced patterns allowed against the consumer tree...
    const custom = new FsAssetResolver(base, false);
    expect(await custom.has("package.json")).toBe(true); // allowed (their tree)
    // ...but traversal is still rejected.
    await expect(custom.read("../AGENTS.md")).rejects.toBeInstanceOf(AssetResolutionError);
  });
});

describe("lazy embedded domain loading + cache invalidation", () => {
  afterEach(() => {
    clearEmbeddedAssets();
    resetAssetResolver();
    delete process.env.TSFULMEN_ASSET_MODE;
  });

  it("ensureEmbeddedDomain lazily loads a generated domain and reads it", async () => {
    const { ensureEmbeddedDomain } = await import("../resolver.js");
    const { hasEmbeddedDomain } = await import("../embedded-resolver.js");
    expect(hasEmbeddedDomain("taxonomy")).toBe(false);

    await ensureEmbeddedDomain("taxonomy");

    expect(hasEmbeddedDomain("taxonomy")).toBe(true);
    const resolver = new EmbeddedAssetResolver();
    expect(await resolver.has("config/crucible-ts/taxonomy/metrics.yaml")).toBe(true);
  });

  it("is a no-op when already registered and throws on unknown domain", async () => {
    const { ensureEmbeddedDomain } = await import("../resolver.js");
    await ensureEmbeddedDomain("foundry");
    await ensureEmbeddedDomain("foundry"); // no-op, no throw
    await expect(ensureEmbeddedDomain("nope")).rejects.toBeInstanceOf(AssetResolutionError);
  });

  it("getAssetResolver(embedded) rebuilds after a domain is registered (entarch)", async () => {
    const { ensureEmbeddedDomain } = await import("../resolver.js");
    const before = getAssetResolver({ mode: "embedded" });
    expect(before.provenance().embeddedCount).toBe(0);

    await ensureEmbeddedDomain("foundry");
    const after = getAssetResolver({ mode: "embedded" });

    expect(after).not.toBe(before); // cache invalidated by registration version
    expect(after.provenance().embeddedCount ?? 0).toBeGreaterThan(0);
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
