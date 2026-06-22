#!/usr/bin/env tsx
/**
 * Validate type declarations for the PUBLIC surface only.
 *
 * Under tsup `splitting:true` the build emits internal shared chunks
 * (`dist/chunk-*.js`, `dist/<name>-<hash>.js`) that have no `.d.ts` and are not
 * public entrypoints. We therefore validate declarations against
 * `package.json#exports` (each must have an existing, non-empty `types` + an
 * existing `import` target) plus the `bin` entry .js files — not arbitrary dist
 * files. (entarch guardrail #2.)
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

interface Pkg {
  exports: Record<string, { import?: string; types?: string } | string>;
  bin?: Record<string, string>;
}

function fileOk(path: string, requireNonEmpty: boolean): boolean {
  try {
    const stats = statSync(path);
    return stats.isFile() && (!requireNonEmpty || stats.size > 0);
  } catch {
    return false;
  }
}

function main(): void {
  const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as Pkg;
  const failures: string[] = [];

  for (const [name, entry] of Object.entries(pkg.exports ?? {})) {
    if (typeof entry === "string") continue; // non-conditional export, skip
    const imp = entry.import;
    const types = entry.types;
    if (imp && !fileOk(resolve(imp), false)) {
      failures.push(`export "${name}": missing import target ${imp}`);
    }
    if (!types) {
      failures.push(`export "${name}": no \`types\` declared`);
    } else if (!fileOk(resolve(types), true)) {
      failures.push(`export "${name}": missing or empty type declaration ${types}`);
    }
  }

  // bin entries are executables — validate the .js exists (no .d.ts required).
  for (const [cmd, target] of Object.entries(pkg.bin ?? {})) {
    if (!fileOk(resolve(target), false)) {
      failures.push(`bin "${cmd}": missing target ${target}`);
    }
  }

  if (failures.length) {
    console.error("❌ Public type/entry validation failed:");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log("✅ Public type declaration validation passed (exports + bins)");
}

main();
