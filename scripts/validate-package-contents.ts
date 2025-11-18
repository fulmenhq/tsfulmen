#!/usr/bin/env tsx
/**
 * Validate expected package contents by inspecting dist/ after build.
 * A lightweight alternative to npm pack for fast CI checks.
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
    if (key === ".") continue;
    if (!entry) continue;
    const paths = [entry.import, entry.types].filter(Boolean) as string[];
    for (const p of paths) {
      const full = resolve(p);
      try {
        const stats = statSync(full);
        if (!stats.isFile() || stats.size === 0) {
          failures.push(`- ${p} missing or empty`);
        }
      } catch {
        failures.push(`- ${p} not found`);
      }
    }
  }

  if (failures.length) {
    console.error("❌ Package contents validation failed:");
    failures.forEach((f) => console.error(f));
    process.exit(1);
  }

  console.log("✅ Package contents validation passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
