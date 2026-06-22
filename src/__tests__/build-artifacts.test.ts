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

    it("should preserve @3leaps/string-metrics-wasm imports (externalized, never inlined)", () => {
      const { readFileSync } = require("node:fs");
      // Under tsup splitting:true the import lives in a shared chunk the similarity
      // entry re-exports from — so scan all of dist, not just the entry file. The
      // invariant is: the package is externalized somewhere, and never inlined as
      // a data: URI anywhere.
      const distPath = join(process.cwd(), "dist");
      const jsFiles = findFilesRecursive(distPath, ".js");

      const externalized = jsFiles.some((f) =>
        readFileSync(f, "utf-8").includes("@3leaps/string-metrics-wasm"),
      );
      expect(externalized).toBe(true);

      for (const f of jsFiles) {
        expect(readFileSync(f, "utf-8")).not.toContain("data:application/wasm");
      }
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
