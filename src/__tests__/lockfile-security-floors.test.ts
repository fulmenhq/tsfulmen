import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findBannedLockfileVersions } from "../../scripts/verify-lockfile-security-floors.ts";

describe("bun.lock security floors", () => {
  it("rejects known vulnerable versions if they reappear", () => {
    const fake = `
      "ajv": ["ajv@8.17.1", "", {}],
      "fast-uri": ["fast-uri@3.1.6", "", {}],
      "brace-expansion": ["brace-expansion@2.0.2", "", {}],
      "glob/minimatch/brace-expansion": ["brace-expansion@5.0.11", "", {}],
      "glob/minimatch": ["minimatch@9.0.5", "", {}],
      "micromatch/picomatch": ["picomatch@2.3.1", "", {}],
      "vite/picomatch": ["picomatch@4.0.3", "", {}],
      "source-map-js": ["source-map-js@1.2.1", "", {}],
      "vite": ["vite@7.3.6", "", {}],
      "tsx/esbuild": ["esbuild@0.27.3", "", {}],
      "fastify": ["fastify@5.8.5", "", {}],
      "find-my-way": ["find-my-way@9.6.0", "", {}],
    `;
    const hits = findBannedLockfileVersions(fake);
    const expected = [
      "ajv@8.17.1",
      "fast-uri@3.1.6",
      "brace-expansion@2.0.2",
      "brace-expansion@5.0.11",
      "minimatch@9.0.5",
      "picomatch@2.3.1",
      "picomatch@4.0.3",
      "source-map-js@1.2.1",
      "vite@7.3.6",
      "esbuild@0.27.3",
      "fastify@5.8.5",
      "find-my-way@9.6.0",
    ];
    for (const id of expected) {
      expect(hits.some((hit) => hit.includes(id)), `expected a hit for ${id}`).toBe(true);
    }
  });

  it("holds current bun.lock to the 2026-10-21 patched floors", () => {
    const lockfile = readFileSync(resolve(process.cwd(), "bun.lock"), "utf8");
    expect(findBannedLockfileVersions(lockfile)).toEqual([]);
  });
});
