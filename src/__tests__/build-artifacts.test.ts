import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("build artifacts", () => {
  describe("WASM externalization", () => {
    it("should not bundle WASM files in dist/", () => {
      const distPath = join(process.cwd(), "dist");
      const wasmFiles = findFilesRecursive(distPath, ".wasm");

      expect(wasmFiles).toEqual([]);
    });

    it("should preserve @3leaps/string-metrics-wasm imports", () => {
      const { readFileSync } = require("node:fs");
      const similarityBuild = join(process.cwd(), "dist/foundry/similarity/index.js");
      const content = readFileSync(similarityBuild, "utf-8");

      expect(content).toContain("from '@3leaps/string-metrics-wasm'");
      expect(content).not.toContain("data:application/wasm");
    });
  });
});

function findFilesRecursive(dir: string, ext: string): string[] {
  const results: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        results.push(...findFilesRecursive(fullPath, ext));
      } else if (entry.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory might not exist yet
  }

  return results;
}
