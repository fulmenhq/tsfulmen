#!/usr/bin/env tsx
/**
 * Validate tsup entrypoints align with package.json exports.
 * Ensures every export (except ".") has a matching tsup entry and vice versa.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const pkgRaw = await readFile(resolve("package.json"), "utf8");
  const pkg = JSON.parse(pkgRaw) as { exports: Record<string, any> };

  const tsupConfig = (await import(resolve("tsup.config.ts"))).default as {
    entry?: Record<string, string>;
  };
  const entryNames = new Set(Object.keys(tsupConfig.entry ?? {}));

  const missingEntries: string[] = [];
  const orphanedEntries: string[] = [];

  // Exports that require tsup entry
  for (const key of Object.keys(pkg.exports)) {
    if (key === ".") continue;
    const expected = `${key.replace(/^\.\//, "")}/index`;
    if (!entryNames.has(expected)) {
      missingEntries.push(`${key} -> expected tsup entry "${expected}"`);
    }
  }

  // tsup entries that don't have exports
  for (const entry of entryNames) {
    if (entry === "index") continue;
    const exportKey = `./${entry.replace(/\/index$/, "")}`;
    if (!pkg.exports[exportKey]) {
      orphanedEntries.push(`${entry} (no matching export ${exportKey})`);
    }
  }

  if (missingEntries.length || orphanedEntries.length) {
    if (missingEntries.length) {
      console.error("❌ Missing tsup entries:");
      missingEntries.forEach((m) => console.error(`- ${m}`));
    }
    if (orphanedEntries.length) {
      console.error("❌ Orphaned tsup entries:");
      orphanedEntries.forEach((m) => console.error(`- ${m}`));
    }
    process.exit(1);
  }

  console.log("✅ tsup configuration validation passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
