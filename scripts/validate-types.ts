#!/usr/bin/env tsx
/**
 * Validate that every built .js file in dist has a corresponding .d.ts.
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...walk(join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

function main() {
  const dist = resolve("dist");
  let ok = true;
  for (const jsFile of walk(dist)) {
    const dts = jsFile.replace(/\.js$/, ".d.ts");
    try {
      const stats = statSync(dts);
      if (!stats.isFile() || stats.size === 0) {
        console.error(`❌ Missing or empty type declaration for ${jsFile}`);
        ok = false;
      }
    } catch {
      console.error(`❌ Missing type declaration for ${jsFile}`);
      ok = false;
    }
  }

  if (!ok) {
    process.exit(1);
  }
  console.log("✅ Type declaration validation passed");
}

main();
