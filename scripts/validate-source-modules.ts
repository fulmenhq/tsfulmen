#!/usr/bin/env tsx
/**
 * Detect source modules with index.ts that lack tsup entry or package export.
 * Fails when a module is missing either mapping unless a .no-export marker is present.
 */
import { readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      files.push(...walk(join(dir, entry.name)));
    } else if (entry.isFile() && entry.name === "index.ts") {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

async function main() {
  const srcRoot = resolve("src");
  const pkgRaw = await readFile(resolve("package.json"), "utf8");
  const pkg = JSON.parse(pkgRaw) as { exports: Record<string, any> };
  const tsupConfig = (await import(resolve("tsup.config.ts"))).default as {
    entry?: Record<string, string>;
  };
  const tsupEntries = new Set(Object.keys(tsupConfig.entry ?? {}));
  const exportsSet = new Set(Object.keys(pkg.exports ?? {}));

  const failures: string[] = [];

  for (const file of walk(srcRoot)) {
    const rel = file.replace(`${srcRoot}/`, "").replace(/\/?index\.ts$/, "");
    const dir = rel === "" ? srcRoot : join(srcRoot, rel);

    // Skip if marker present
    try {
      statSync(join(dir, ".no-export"));
      continue;
    } catch {
      // no marker, continue checks
    }

    // Handle root index.ts specially
    const expectEntry = rel === "" ? "index" : `${rel}/index`;
    const expectExport = rel === "" ? "." : `./${rel}`;

    if (!tsupEntries.has(expectEntry) || !exportsSet.has(expectExport)) {
      failures.push(
        `${rel || "index.ts"}: tsup entry ${tsupEntries.has(expectEntry) ? "✅" : "❌"} | export ${
          exportsSet.has(expectExport) ? "✅" : "❌"
        }`,
      );
    }
  }

  if (failures.length) {
    console.error("❌ Source modules missing build/export mapping:");
    failures.forEach((f) => console.error(`- ${f}`));
    process.exit(1);
  }

  console.log("✅ Source module mapping validation passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
