#!/usr/bin/env bun
/**
 * Fail if patched 2026-10-21 lockfile floors are reverted in bun.lock.
 *
 * Braces@3.0.3 (GHSA-vfj7-8cjw-p6xm, no upstream fix) and vitest 4.1.11
 * (cooling until 2026-10-22) are held on purpose and are not banned here.
 *
 * Override reasons (package.json#overrides):
 * - ajv >=8.18.0 — GHSA-2g4f-4pwh-qvx6 / CVE-2025-69873 ($data ReDoS)
 * - brace-expansion@^2 2.1.7 / @^5 5.0.12 — nested glob/minimatch DoS cluster
 * - esbuild@0.28 0.28.1 — GHSA-g7r4-m6w7-qqqr (Windows dev-server read)
 * - fast-uri >=3.1.8 — GHSA-qw65-cvwx-89v3 / GHSA-58mr-gqgx-xq4g / GHSA-hrr3-gc8f-f4qj
 * - minimatch@^9 >=9.0.7 <10 — GHSA-3ppc-4f35-3m26 / GHSA-7r86-cg39-jmmj / GHSA-23c5-xmqv-rm74
 * - picomatch@^2 2.3.2 / @4.0.3 4.0.4 — GHSA-c2c7-rcm5-vvqj / GHSA-3v7f-55p6-f55p
 * - source-map-js >=1.2.2 — GHSA-68fv-2mgg-jv7q
 * - vite 7.3.7 — GHSA-587h-7wmj-h5pm and related 7.3.6 advisories
 * - fastify 5.12.7 (direct) — GHSA-667r-xxjv-c9mm and related 5.8.5 advisories
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Identity {
  name: string;
  version: string;
}

function parseIdentities(lockfile: string): Identity[] {
  const found: Identity[] = [];
  const re = /\["((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)@(\d+\.\d+\.\d+[^"]*)"/gi;
  for (const match of lockfile.matchAll(re)) {
    found.push({ name: match[1], version: match[2] });
  }
  return found;
}

function triple(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`unparseable version: ${version}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function cmp(a: string, b: string): number {
  const left = triple(a);
  const right = triple(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) {
      return left[i] - right[i];
    }
  }
  return 0;
}

interface Floor {
  reason: string;
  match: (pkg: Identity) => boolean;
}

const FLOORS: Floor[] = [
  {
    reason: "ajv <8.18.0 (GHSA-2g4f-4pwh-qvx6)",
    match: (pkg) => pkg.name === "ajv" && cmp(pkg.version, "8.18.0") < 0,
  },
  {
    reason: "fast-uri <3.1.8 (GHSA-qw65-cvwx-89v3 / GHSA-58mr-gqgx-xq4g / GHSA-hrr3-gc8f-f4qj)",
    match: (pkg) => pkg.name === "fast-uri" && cmp(pkg.version, "3.1.8") < 0,
  },
  {
    reason: "brace-expansion 2.x <2.1.7 (DoS cluster)",
    match: (pkg) =>
      pkg.name === "brace-expansion" &&
      triple(pkg.version)[0] === 2 &&
      cmp(pkg.version, "2.1.7") < 0,
  },
  {
    reason: "brace-expansion 5.x <5.0.12 (DoS cluster)",
    match: (pkg) =>
      pkg.name === "brace-expansion" &&
      triple(pkg.version)[0] === 5 &&
      cmp(pkg.version, "5.0.12") < 0,
  },
  {
    reason: "minimatch <9.0.7 (GHSA-3ppc-4f35-3m26 / GHSA-7r86-cg39-jmmj / GHSA-23c5-xmqv-rm74)",
    match: (pkg) => pkg.name === "minimatch" && cmp(pkg.version, "9.0.7") < 0,
  },
  {
    reason: "picomatch 2.x <2.3.2 (GHSA-c2c7-rcm5-vvqj / GHSA-3v7f-55p6-f55p)",
    match: (pkg) =>
      pkg.name === "picomatch" && triple(pkg.version)[0] === 2 && cmp(pkg.version, "2.3.2") < 0,
  },
  {
    reason: "picomatch 4.x <4.0.4 (GHSA-c2c7-rcm5-vvqj / GHSA-3v7f-55p6-f55p)",
    match: (pkg) =>
      pkg.name === "picomatch" && triple(pkg.version)[0] === 4 && cmp(pkg.version, "4.0.4") < 0,
  },
  {
    reason: "source-map-js <1.2.2 (GHSA-68fv-2mgg-jv7q)",
    match: (pkg) => pkg.name === "source-map-js" && cmp(pkg.version, "1.2.2") < 0,
  },
  {
    reason: "vite 7.x <=7.3.6 (GHSA-587h-7wmj-h5pm cluster)",
    match: (pkg) =>
      pkg.name === "vite" && triple(pkg.version)[0] === 7 && cmp(pkg.version, "7.3.7") < 0,
  },
  {
    reason: "esbuild >=0.27.3 <0.28.1 (GHSA-g7r4-m6w7-qqqr)",
    match: (pkg) =>
      pkg.name === "esbuild" && cmp(pkg.version, "0.27.3") >= 0 && cmp(pkg.version, "0.28.1") < 0,
  },
  {
    reason: "fastify 5.x <5.12.7 (GHSA-667r-xxjv-c9mm cluster)",
    match: (pkg) =>
      pkg.name === "fastify" && triple(pkg.version)[0] === 5 && cmp(pkg.version, "5.12.7") < 0,
  },
  {
    reason: "find-my-way <=9.6.0 (GHSA-c96f-x56v-gq3h)",
    match: (pkg) => pkg.name === "find-my-way" && cmp(pkg.version, "9.6.0") <= 0,
  },
];

export function findBannedLockfileVersions(lockfile: string): string[] {
  const hits: string[] = [];
  const seen = new Set<string>();
  for (const pkg of parseIdentities(lockfile)) {
    for (const floor of FLOORS) {
      if (!floor.match(pkg)) {
        continue;
      }
      const key = `${pkg.name}@${pkg.version} ${floor.reason}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      hits.push(key);
    }
  }
  return hits;
}

function main(): void {
  const lockPath = resolve(process.cwd(), "bun.lock");
  const lockfile = readFileSync(lockPath, "utf8");
  const hits = findBannedLockfileVersions(lockfile);
  if (hits.length > 0) {
    console.error("bun.lock reintroduced patched vulnerable versions:");
    for (const hit of hits) {
      console.error(`  - ${hit}`);
    }
    process.exit(1);
  }
  console.log("✅ bun.lock security floors hold");
}

if (import.meta.main) {
  main();
}
