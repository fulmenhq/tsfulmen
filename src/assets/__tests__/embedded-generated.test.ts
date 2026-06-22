/**
 * Embedded generated-manifest tests (v0.4.0 T3)
 *
 * Verifies the checked-in generated modules register correctly and that the
 * embedded resolver reaches parity with the filesystem resolver — the guardrail
 * entarch asked for (list() vs fast-glob over the real schema set). Drift of the
 * generated modules vs. the on-disk trees is separately enforced by
 * `make verify-embedded-assets`.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearEmbeddedAssets, EmbeddedAssetResolver } from "../embedded-resolver.js";
import { FsAssetResolver } from "../fs-resolver.js";
import { embeddedManifests, registerAllEmbeddedAssets } from "../generated/index.js";
import { findAssetBaseDir } from "../resolver.js";

const SCHEMA_GLOB = ["schemas/crucible-ts/**/*.schema.{json,yaml,yml}"];
const DRAFT07 = "schemas/crucible-ts/meta/draft-07/schema.json";
const SIGNALS = "config/crucible-ts/library/foundry/signals.yaml";
const METRICS = "config/crucible-ts/taxonomy/metrics.yaml";

describe("generated embedded manifests", () => {
  beforeEach(() => {
    clearEmbeddedAssets();
    registerAllEmbeddedAssets();
  });

  afterEach(() => {
    clearEmbeddedAssets();
  });

  it("registers the expected domains", () => {
    const domains = embeddedManifests.map((m) => m.domain).sort();
    expect(domains).toEqual(["foundry", "metaschema", "schemas", "taxonomy"]);
  });

  it("embeds and reads the draft-07 metaschema (parseable)", async () => {
    const resolver = new EmbeddedAssetResolver();
    const parsed = JSON.parse(await resolver.read(DRAFT07));
    expect(parsed.$schema).toContain("draft-07");
  });

  it("embeds the foundry signals catalog (the serve blocker)", async () => {
    const resolver = new EmbeddedAssetResolver();
    expect(await resolver.read(SIGNALS)).toContain("signals");
  });

  it("embeds the cross-tree taxonomy asset referenced by schema $ref (T1 site D)", async () => {
    const resolver = new EmbeddedAssetResolver();
    expect(await resolver.has(METRICS)).toBe(true);
  });

  it("list() parity: embedded schema enumeration matches the filesystem exactly", async () => {
    const base = findAssetBaseDir();
    if (!base) throw new Error("asset base dir not found");
    const fsList = await new FsAssetResolver(base).list(SCHEMA_GLOB);
    const embList = await new EmbeddedAssetResolver().list(SCHEMA_GLOB);

    expect(embList.length).toBe(fsList.length);
    expect(embList).toEqual(fsList);
  });
});
