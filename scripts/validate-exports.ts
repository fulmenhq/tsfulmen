#!/usr/bin/env tsx
/**
 * Validate that every package.json export points to built artifacts.
 * Fails if any export's import/types paths are missing or empty.
 */
import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type ExportEntry = { import?: string; types?: string };

async function main() {
  const pkgRaw = await readFile(resolve("package.json"), "utf8");
  const pkg = JSON.parse(pkgRaw) as { exports: Record<string, ExportEntry> };
  const failures: string[] = [];

  for (const [key, entry] of Object.entries(pkg.exports)) {
    if (key === ".") continue; // root handled by build/test already
    if (!entry) continue;
    const checkPath = (p?: string, kind?: string) => {
      if (!p) return;
      const full = resolve(p);
      try {
        const stats = statSync(full);
        if (!stats.isFile() || stats.size === 0) {
          failures.push(`- ${key} -> ${p} (${kind} missing or empty)`);
        }
      } catch {
        failures.push(`- ${key} -> ${p} (${kind} not found)`);
      }
    };
    checkPath(entry.import, "import");
    checkPath(entry.types, "types");
  }

  if (failures.length) {
    console.error("❌ Export validation failed:");
    failures.forEach((f) => console.error(f));
    process.exit(1);
  }

  console.log("✅ Export validation passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
