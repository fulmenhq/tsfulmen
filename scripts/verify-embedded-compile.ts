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
const FIXTURE = join(ROOT, "scripts", "fixtures", "embedded-compile-fixture.ts");

let tempDir: string | undefined;
let runDir: string | undefined;
let failed = false;

try {
  console.log(`\n${YELLOW}📦 Embedded-asset compile proof (bun build --compile)${RESET}\n`);

  tempDir = mkdtempSync(join(tmpdir(), "tsfulmen-embed-compile-"));
  // A separate empty cwd to run the binary from — guarantees no asset tree is
  // reachable relative to the process working directory.
  runDir = mkdtempSync(join(tmpdir(), "tsfulmen-embed-run-"));
  const binary = join(tempDir, "fixture");

  console.log("1️⃣  Compiling fixture (bun build --compile)...");
  execSync(`bun build --compile ${JSON.stringify(FIXTURE)} --outfile ${JSON.stringify(binary)}`, {
    cwd: ROOT,
    stdio: "pipe",
  });
  console.log(`   ${GREEN}✓${RESET} compile succeeded`);

  console.log(`2️⃣  Running binary from a temp cwd with no asset tree (${runDir})...`);
  const out = execFileSync(binary, {
    cwd: runDir,
    encoding: "utf-8",
    // Belt-and-suspenders: even auto would have to fall back to embedded here.
    env: { ...process.env, TSFULMEN_ASSET_MODE: "embedded" },
  });

  const staticOk = /STATIC_EMBED_OK count=\d+ schemas=\d+/.test(out);
  const lazyMatch = out.match(/LAZY_IMPORT_OK=(\w+)/);
  const lazyOk = lazyMatch?.[1] === "true";

  console.log(
    `\n   ${staticOk ? GREEN + "✓" : RED + "✗"}${RESET} embedded read + enumerate in-binary`,
  );
  console.log(
    `   ${lazyOk ? GREEN + "✓" : YELLOW + "•"}${RESET} dynamic import() of a domain module ${lazyOk ? "survives" : "does NOT survive"} --compile`,
  );
  console.log(`\n   binary output: ${out.trim().split("\n").join(" | ")}`);

  if (!staticOk) {
    failed = true;
  }

  console.log(`\n${YELLOW}── Packaging decision (entarch §0.7) ──${RESET}`);
  if (lazyOk) {
    console.log("   Lazy import() works → per-domain lazy split is viable.");
  } else {
    console.log(
      "   Lazy import() unavailable → use STATIC per-subpath registration (each\n" +
        "   subpath export imports only its domain manifest). Never a global manifest.",
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
