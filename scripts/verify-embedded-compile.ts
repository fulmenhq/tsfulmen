#!/usr/bin/env bun
/**
 * Verify embedded SSOT assets resolve inside a `bun build --compile` single-file
 * binary (v0.4.0 T3 proof).
 *
 * Compiles `scripts/fixtures/embedded-compile-fixture.ts` and runs the resulting
 * binary from a temp cwd that has NO asset tree on disk, asserting embedded reads
 * + enumeration work. Also reports whether dynamic `import()` of a domain module
 * survives `--compile` — the data point that decides lazy-split vs
 * static-per-subpath packaging (entarch §0.7).
 *
 * Usage: bunx tsx scripts/verify-embedded-compile.ts
 */

import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const ROOT = process.cwd();
const STATIC_FIXTURE = join(ROOT, "scripts", "fixtures", "embedded-compile-fixture.ts");
const LAZY_FIXTURE = join(ROOT, "scripts", "fixtures", "embedded-lazy-fixture.ts");

let tempDir: string | undefined;
let runDir: string | undefined;
let failed = false;

function compileAndRun(fixture: string, label: string, outDir: string, cwd: string): string {
  const binary = join(outDir, `${label}-bin`);
  execSync(`bun build --compile ${JSON.stringify(fixture)} --outfile ${JSON.stringify(binary)}`, {
    cwd: ROOT,
    stdio: "pipe",
  });
  return execFileSync(binary, {
    cwd,
    encoding: "utf-8",
    // Force embedded so even `auto` cannot reach a filesystem asset tree.
    env: { ...process.env, TSFULMEN_ASSET_MODE: "embedded" },
  });
}

try {
  console.log(`\n${YELLOW}📦 Embedded-asset compile proof (bun build --compile)${RESET}\n`);

  tempDir = mkdtempSync(join(tmpdir(), "tsfulmen-embed-compile-"));
  // A separate empty cwd to run the binaries from — guarantees no asset tree is
  // reachable relative to the process working directory.
  runDir = mkdtempSync(join(tmpdir(), "tsfulmen-embed-run-"));

  console.log("1️⃣  STATIC fixture: compile + run from temp cwd (no asset tree)...");
  const staticOut = compileAndRun(STATIC_FIXTURE, "static", tempDir, runDir);
  const staticOk = /STATIC_EMBED_OK count=\d+ schemas=\d+/.test(staticOut);

  // De-confounded lazy proof (devrev): the lazy fixture does NOT statically
  // import the probed domain, so this proves a COLD lazy-only module survives.
  console.log("2️⃣  COLD LAZY fixture: domain reachable only via dynamic import()...");
  const lazyOut = compileAndRun(LAZY_FIXTURE, "lazy", tempDir, runDir);
  const lazyOk = /LAZY_COLD_OK=true/.test(lazyOut);

  console.log(
    `\n   ${staticOk ? `${GREEN}✓` : `${RED}✗`}${RESET} static embedded read + enumerate in-binary`,
  );
  console.log(
    `   ${lazyOk ? `${GREEN}✓` : `${YELLOW}•`}${RESET} cold (statically-unreferenced) domain via dynamic import() ${lazyOk ? "survives" : "does NOT survive"} --compile`,
  );
  console.log(`\n   static output: ${staticOut.trim()}`);
  console.log(`   lazy output:   ${lazyOut.trim()}`);

  if (!staticOk) {
    failed = true;
  }

  console.log(`\n${YELLOW}── Packaging decision (entarch §0.7) ──${RESET}`);
  if (lazyOk) {
    console.log("   Cold dynamic import() works → per-domain LAZY split is viable.");
  } else {
    console.log(
      "   Cold dynamic import() does NOT survive --compile → use STATIC per-subpath\n" +
        "   registration (each subpath imports only its domain). Never a global manifest.",
    );
  }

  console.log(
    `\n${failed ? `${RED}❌ EMBED COMPILE PROOF FAILED${RESET}` : `${GREEN}✅ EMBED COMPILE PROOF PASSED${RESET}`}\n`,
  );
} catch (error) {
  failed = true;
  console.error(`\n${RED}❌ EMBED COMPILE PROOF ERRORED${RESET}`);
  console.error(error instanceof Error ? error.message : error);
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  if (runDir) rmSync(runDir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
