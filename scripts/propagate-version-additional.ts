#!/usr/bin/env tsx
/**
 * Additional Version Propagation
 *
 * Workaround script until goneat supports arbitrary path-based version propagation.
 * Updates source files and tests that reference VERSION constants or assertions.
 *
 * This script is called by `make version-propagate` after `goneat version propagate`.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const VERSION_FILE = join(process.cwd(), "VERSION");
const FILES_TO_UPDATE = [
  {
    path: "src/index.ts",
    pattern: /export const VERSION = "[^"]+";/,
    replacement: (version: string) => `export const VERSION = "${version}";`,
  },
  {
    path: "src/__tests__/index.test.ts",
    pattern: /expect\(VERSION\)\.toBe\("[^"]+"\);/,
    replacement: (version: string) => `expect(VERSION).toBe("${version}");`,
  },
];

async function main() {
  // Read target version
  const version = (await readFile(VERSION_FILE, "utf-8")).trim();

  let updatedCount = 0;

  for (const file of FILES_TO_UPDATE) {
    const filePath = join(process.cwd(), file.path);
    const content = await readFile(filePath, "utf-8");
    const newContent = content.replace(file.pattern, file.replacement(version));

    if (content !== newContent) {
      await writeFile(filePath, newContent, "utf-8");
      updatedCount++;
      console.log(`  ✓ Updated ${file.path} to version ${version}`);
    }
  }

  if (updatedCount === 0) {
    console.log("  ℹ All files already at correct version");
  }
}

main().catch((error) => {
  console.error("Error propagating version:", error);
  process.exit(1);
});
