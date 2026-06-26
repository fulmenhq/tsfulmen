/**
 * AssetResolver security hardening (v0.4.1 — secrev P3 defers).
 *
 * 1. Namespace tightened to the actually-shipped `<ns>/crucible-ts/` subtree.
 * 2. FsAssetResolver resolves symlinks and rejects targets that escape baseDir.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AssetResolutionError } from "../errors.js";
import { FsAssetResolver } from "../fs-resolver.js";
import { assertSafeLogicalPath, assertSafePattern } from "../paths.js";

describe("namespace tightened to <ns>/crucible-ts/ (secrev)", () => {
  it("accepts paths under the crucible-ts subtree", () => {
    expect(() => assertSafeLogicalPath("schemas/crucible-ts/x.schema.json")).not.toThrow();
    expect(() =>
      assertSafeLogicalPath("config/crucible-ts/library/foundry/signals.yaml"),
    ).not.toThrow();
    expect(() => assertSafePattern("schemas/crucible-ts/**/*.schema.json")).not.toThrow();
  });

  it("rejects in-namespace-but-not-crucible-ts paths", () => {
    for (const p of ["schemas/foo.schema.json", "config/other/x.yaml", "docs/readme.md"]) {
      expect(() => assertSafeLogicalPath(p)).toThrow(/crucible-ts/);
    }
  });

  it("still rejects out-of-namespace + traversal", () => {
    expect(() => assertSafeLogicalPath("package.json")).toThrow();
    expect(() => assertSafeLogicalPath("../AGENTS.md")).toThrow();
  });

  it("consumer baseDir override (enforceNamespace=false) skips the namespace lock but keeps traversal guards", () => {
    expect(() => assertSafeLogicalPath("anything/local/x.json", false)).not.toThrow();
    expect(() => assertSafeLogicalPath("../escape", false)).toThrow();
  });
});

describe("FsAssetResolver symlink escape rejection (secrev)", () => {
  let base: string;
  let outside: string;

  beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), "tsf-base-"));
    outside = mkdtempSync(join(tmpdir(), "tsf-outside-"));
    mkdirSync(join(base, "schemas", "crucible-ts"), { recursive: true });
    // A real in-tree asset (control).
    writeFileSync(join(base, "schemas", "crucible-ts", "real.json"), '{"ok":true}');
    // A secret outside baseDir + a symlink to it inside the crucible-ts subtree.
    writeFileSync(join(outside, "secret.json"), '{"secret":true}');
    symlinkSync(join(outside, "secret.json"), join(base, "schemas", "crucible-ts", "link.json"));
  });

  afterAll(() => {
    rmSync(base, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("reads a real in-tree asset", async () => {
    const r = new FsAssetResolver(base);
    expect(await r.read("schemas/crucible-ts/real.json")).toContain("ok");
    expect(await r.has("schemas/crucible-ts/real.json")).toBe(true);
  });

  it("rejects reading a symlink that escapes baseDir", async () => {
    const r = new FsAssetResolver(base);
    await expect(r.read("schemas/crucible-ts/link.json")).rejects.toBeInstanceOf(
      AssetResolutionError,
    );
    expect(await r.has("schemas/crucible-ts/link.json")).toBe(false);
  });
});
