#!/usr/bin/env bun
/**
 * Guard the embedded-asset DIST PARTITION (v0.4.0, entarch guardrail #1).
 *
 * With tsup `splitting:true` the embedded SSOT corpus must live in shared chunks,
 * NOT in the public entry files, and must not be duplicated across entries. This
 * asserts:
 *   1. every public entry (package.json#exports import targets + bin targets) is
 *      lean — contains no embedded-corpus markers;
 *   2. corpus markers appear only in non-entry chunk files;
 *   3. the schema corpus is not duplicated — its marker appears in at most one file.
 * Prints a size report either way.
 *
 * Run after `make build`. Usage: bunx tsx scripts/verify-dist-asset-partition.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

// Markers that appear ONLY inside the embedded corpus, not in legitimate source
// references. (Looser strings like "http-status-groups" / "schemas/crucible-ts/"
// occur in foundry schema-id and crucible path code, so they are NOT usable here.)
const CORPUS_MARKERS = ["box-chars.schema.json"];
// The schemas-domain marker used for the duplication check (must be in EXACTLY one chunk).
const DEDUP_MARKER = "box-chars.schema.json";
// Corpus-specific per-domain presence markers (for the report + presence assertion),
// so the guard is not schema-only. (entarch/devrev)
const DOMAIN_MARKERS: Record<string, string> = {
  schemas: "box-chars.schema.json",
  foundry: "config/crucible-ts/library/foundry/signals.yaml",
  taxonomy: "config/crucible-ts/taxonomy/metrics.yaml",
};
// Belt-and-suspenders: a public entry should never approach corpus size. The
// largest legitimate entry is ~36 KB (pathfinder); the corpus is ~550 KB.
const MAX_ENTRY_BYTES = 100 * 1024;

interface Pkg {
  exports: Record<string, { import?: string } | string>;
  bin?: Record<string, string>;
}

const dist = resolve("dist");

function distJsFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith(".js")) out.push(p);
    }
  };
  walk(dist);
  return out;
}

function hasCorpus(content: string): boolean {
  return CORPUS_MARKERS.some((m) => content.includes(m));
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function main(): void {
  const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as Pkg;

  const publicEntries = new Set<string>();
  for (const entry of Object.values(pkg.exports ?? {})) {
    if (typeof entry !== "string" && entry.import) publicEntries.add(resolve(entry.import));
  }
  for (const target of Object.values(pkg.bin ?? {})) publicEntries.add(resolve(target));

  const failures: string[] = [];
  let dedupCount = 0;
  let corpusChunkBytes = 0;
  const entryReport: string[] = [];
  const domainFiles: Record<string, number> = { schemas: 0, foundry: 0, taxonomy: 0 };

  for (const file of distJsFiles()) {
    const content = readFileSync(file, "utf8");
    const size = statSync(file).size;
    const isEntry = publicEntries.has(file);
    const carriesCorpus = hasCorpus(content);

    if (content.includes(DEDUP_MARKER)) dedupCount++;
    for (const [domain, marker] of Object.entries(DOMAIN_MARKERS)) {
      if (!isEntry && content.includes(marker)) domainFiles[domain]++;
    }

    if (isEntry) {
      const tooBig = size > MAX_ENTRY_BYTES;
      const bad = carriesCorpus || tooBig;
      entryReport.push(
        `   ${bad ? `${RED}✗` : `${GREEN}✓`}${RESET} ${kb(size)}  ${file.replace(`${dist}/`, "")}`,
      );
      if (carriesCorpus) {
        failures.push(`public entry carries embedded corpus: ${file.replace(`${dist}/`, "")}`);
      }
      if (tooBig) {
        failures.push(
          `public entry ${file.replace(`${dist}/`, "")} is ${kb(size)} (> ${kb(MAX_ENTRY_BYTES)} cap)`,
        );
      }
    } else if (carriesCorpus) {
      corpusChunkBytes += size;
    }
  }

  // Require EXACTLY one shared chunk for the schema corpus: >1 = duplication
  // regressed; 0 = corpus vanished from dist entirely (guard must catch both). (devrev)
  if (dedupCount !== 1) {
    failures.push(
      `schema corpus must live in exactly 1 shared chunk, found ${dedupCount} ` +
        `(>1 = duplication; 0 = corpus missing from dist)`,
    );
  }
  // Each embedded domain must be present in some chunk (catches a dropped domain).
  for (const [domain, count] of Object.entries(domainFiles)) {
    if (count === 0) {
      failures.push(`embedded domain "${domain}" not found in any dist chunk`);
    }
  }

  console.log(`\n${YELLOW}── dist asset partition ──${RESET}`);
  console.log(entryReport.join("\n"));
  console.log(
    `\n   corpus in ${dedupCount} chunk file(s), ~${kb(corpusChunkBytes)} of chunked asset content`,
  );
  console.log(
    `   domain presence (chunks): ${Object.entries(domainFiles)
      .map(([d, c]) => `${d}=${c}`)
      .join(" ")}`,
  );

  if (failures.length) {
    console.error(`\n${RED}❌ dist asset partition violated:${RESET}`);
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }
  console.log(
    `\n${GREEN}✅ dist asset partition OK${RESET} — entries lean, corpus chunked + deduped\n`,
  );
}

main();
