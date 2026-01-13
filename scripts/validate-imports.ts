#!/usr/bin/env tsx
/**
 * Simulate consumer imports against built artifacts in dist/.
 * Ensures export paths resolve and modules load without runtime errors.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const pkgRaw = await readFile(resolve("package.json"), "utf8");
  const pkg = JSON.parse(pkgRaw) as { exports: Record<string, { import?: string }> };
  const failures: string[] = [];

  for (const [key, entry] of Object.entries(pkg.exports)) {
    if (key === ".") continue;
    const importPath = entry?.import;
    if (!importPath) continue;
    const url = pathToFileURL(resolve(importPath)).href;
    try {
      await import(url);
    } catch (error) {
      failures.push(`${key} failed to import: ${(error as Error).message}`);
    }
  }

  if (failures.length) {
    console.error("❌ Consumer import validation failed:");
    for (const f of failures) {
      console.error(`- ${f}`);
    }
    process.exit(1);
  }

  console.log("✅ Consumer import validation passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
