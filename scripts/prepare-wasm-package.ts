#!/usr/bin/env bun
/**
 * Prepare package artifacts prior to npm publish.
 *
 * - Removes nested .gitignore created by wasm-pack (if present)
 * - Cleans stale dist/wasm outputs
 *
 * Safe to run even when no WASM artifacts exist (no-op).
 */

import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const rootDir = resolve(__dirname, "..");

const wasmGitignore = join(rootDir, "pkg", "web", ".gitignore");
const distWasmDir = join(rootDir, "dist", "wasm");

async function removeGitignore(): Promise<void> {
  try {
    await fs.rm(wasmGitignore, { force: true });
    console.log(`[prepare-wasm-package] cleaned ${wasmGitignore}`);
  } catch (error) {
    console.error(`[prepare-wasm-package] failed to clean ${wasmGitignore}:`, error);
    process.exitCode = 1;
  }
}

async function removeDistWasm(): Promise<void> {
  try {
    await fs.rm(distWasmDir, { recursive: true, force: true });
    console.log(`[prepare-wasm-package] removed stale ${distWasmDir}`);
  } catch (error) {
    console.error(`[prepare-wasm-package] failed to remove ${distWasmDir}:`, error);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  await Promise.all([removeGitignore(), removeDistWasm()]);
}

main().catch((error) => {
  console.error("[prepare-wasm-package] unexpected error", error);
  process.exitCode = 1;
});
