#!/usr/bin/env bun
/**
 * Guard: the published `./assets` entry must stay LEAN (v0.4.0).
 *
 * Embedded SSOT assets are registered static-per-subpath, so the `./assets`
 * resolver core must NOT bundle the generated corpus. Under tsup `splitting:false`
 * any (even dynamic) reference to a generated domain from the assets entry would
 * inline the whole corpus into `dist/assets/index.js` (devrev caught exactly this).
 * This guard fails the build if that regresses.
 *
 * Run after `make build`. Usage: bunx tsx scripts/verify-assets-dist-lean.ts
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const ENTRY = join(process.cwd(), "dist", "assets", "index.js");
// The lean resolver core is a few KB; the full corpus is ~500 KB. 64 KB leaves
// generous headroom for the core while catching any corpus leak.
const MAX_BYTES = 64 * 1024;
// Content markers that only appear if a generated domain corpus leaked in.
const CORPUS_MARKERS = [
  "schemas/crucible-ts/", // embedded schema logical-path keys
  "box-chars.schema.json",
  "http-status-groups",
];

let content: string;
let bytes: number;
try {
  content = readFileSync(ENTRY, "utf-8");
  bytes = statSync(ENTRY).size;
} catch {
  console.error(`${RED}❌ ${ENTRY} not found — run \`make build\` first.${RESET}`);
  process.exit(1);
}

const leaked = CORPUS_MARKERS.filter((m) => content.includes(m));
const tooBig = bytes > MAX_BYTES;

if (leaked.length > 0 || tooBig) {
  console.error(
    `${RED}❌ dist/assets/index.js is not lean — embedded corpus leaked into ./assets.${RESET}`,
  );
  if (tooBig) {
    console.error(`   size ${(bytes / 1024).toFixed(1)} KB exceeds ${MAX_BYTES / 1024} KB cap`);
  }
  if (leaked.length > 0) {
    console.error(`   found corpus markers: ${leaked.join(", ")}`);
  }
  console.error("   The ./assets core must not statically OR dynamically reference generated/*.");
  process.exit(1);
}

console.log(
  `${GREEN}✅ ./assets entry is lean${RESET} (${(bytes / 1024).toFixed(1)} KB, no corpus markers)`,
);
