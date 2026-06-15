#!/usr/bin/env tsx
/**
 * Compiled-binary smoke test (`bun build --compile`).
 *
 * Regression guard for the two blockers that shipped silently in v0.3.0 and
 * surfaced downstream in forge-workhorse-tuvan's compiled binary:
 *
 *   1. CLI shadowing — importing `@fulmenhq/tsfulmen/schema` self-executed
 *      tsfulmen's CLI on import, so a compiled consumer ran `tsfulmen-schema`
 *      instead of its own program (fixed in T2).
 *   2. WASM ENOENT — `@3leaps/string-metrics-wasm` 0.3.8 eagerly loaded its
 *      `.wasm` via a path `--compile` rewrites but does not embed, crashing the
 *      compiled binary at startup (fixed by bumping to 0.3.10).
 *
 * Both broke silently because nothing exercised the `--compile` path. This test
 * owns that guard upstream: it packs the real tarball, installs it into an
 * isolated consumer, `bun build --compile`s a fixture that imports BOTH the
 * schema subpath (shadow trigger) and the similarity subpath (WASM trigger),
 * then asserts the compiled binary runs the consumer's own CLI and loads WASM.
 *
 * Exit codes: 0 = guard passed; 1 = a regression is present, DO NOT publish.
 */

import { exec } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const CONSUMER_VERSION = "9.9.9";
const CONSUMER_NAME = "compile-smoke-consumer";

interface Check {
  name: string;
  passed: boolean;
  detail?: string;
}

/** Run a command and capture stdout/stderr/exit code without throwing. */
async function run(
  cmd: string,
  cwd: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd });
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.code ?? 1 };
  }
}

async function main() {
  console.log(`\n${YELLOW}📦 Compiled-binary smoke test (bun build --compile)${RESET}\n`);

  const checks: Check[] = [];
  let tempDir: string | null = null;
  let tarballPath: string | null = null;

  try {
    console.log("1️⃣  Packing package (npm pack)...");
    const { stdout } = await execAsync("npm pack --quiet");
    tarballPath = stdout.trim();
    console.log(`   ✅ ${tarballPath}\n`);

    console.log("2️⃣  Creating isolated consumer...");
    tempDir = await mkdtemp(join(tmpdir(), "tsfulmen-compile-smoke-"));
    await execAsync(`npm install --no-save "${join(process.cwd(), tarballPath)}"`, {
      cwd: tempDir,
    });
    console.log(`   ✅ Installed tarball into ${tempDir}\n`);

    // Fixture imports BOTH trigger surfaces and defines its own commander CLI.
    const fixture = `import { Command } from "commander";
// Shadow trigger: importing the schema subpath must NOT self-execute tsfulmen's CLI.
import "@fulmenhq/tsfulmen/schema";
// WASM trigger: similarity uses @3leaps/string-metrics-wasm (ENOENT under --compile before 0.3.10).
import { score } from "@fulmenhq/tsfulmen/foundry/similarity";

const program = new Command();
program
  .name("${CONSUMER_NAME}")
  .version("${CONSUMER_VERSION}")
  .description("compile smoke fixture consumer");
program
  .command("run")
  .description("exercise the WASM-backed similarity path")
  .action(() => {
    const s = score("kitten", "sitting");
    console.log("WASM_OK score=" + String(s));
  });
program.parse(process.argv);
`;
    await writeFile(join(tempDir, "consumer.ts"), fixture);

    console.log("3️⃣  Compiling fixture (bun build --compile)...");
    const compile = await run("bun build --compile consumer.ts --outfile consumer", tempDir);
    checks.push({
      name: "bun build --compile succeeds",
      passed: compile.code === 0,
      detail: compile.code === 0 ? undefined : compile.stderr || compile.stdout,
    });
    if (compile.code !== 0) throw new Error("compile failed; skipping runtime assertions");
    console.log("   ✅ Compiled\n");

    console.log("4️⃣  Asserting the consumer owns its CLI (no shadowing)...");
    const version = await run("./consumer --version", tempDir);
    checks.push({
      name: "compiled --version is the consumer's, not tsfulmen-schema",
      passed: version.code === 0 && version.stdout.trim() === CONSUMER_VERSION,
      detail: `exit=${version.code} stdout="${version.stdout.trim()}"`,
    });

    const help = await run("./consumer --help", tempDir);
    checks.push({
      name: "compiled --help shows the consumer, not tsfulmen-schema",
      passed:
        help.code === 0 &&
        help.stdout.includes(CONSUMER_NAME) &&
        !help.stdout.includes("tsfulmen-schema"),
      detail: help.stdout.includes("tsfulmen-schema")
        ? "tsfulmen-schema leaked into help"
        : undefined,
    });

    console.log("5️⃣  Asserting WASM loads in the compiled binary (no ENOENT)...");
    const wasm = await run("./consumer run", tempDir);
    checks.push({
      name: "compiled binary loads string-metrics WASM (no ENOENT)",
      passed: wasm.code === 0 && wasm.stdout.includes("WASM_OK"),
      detail: `exit=${wasm.code} ${wasm.stderr.includes("ENOENT") ? "(ENOENT!)" : ""} stdout="${wasm.stdout.trim()}"`,
    });
  } catch (error) {
    checks.push({
      name: "compile smoke harness",
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    console.log("\n6️⃣  Cleaning up...");
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    if (tarballPath) await rm(tarballPath, { force: true });
    console.log("   ✅ Done\n");
  }

  console.log(`${YELLOW}═══════════════════════════════════════${RESET}\n`);
  for (const c of checks) {
    console.log(`  ${c.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`} ${c.name}`);
    if (!c.passed && c.detail) console.log(`      ${c.detail}`);
  }
  console.log();

  const failed = checks.filter((c) => !c.passed).length;
  if (failed > 0) {
    console.log(`${RED}❌ COMPILE SMOKE FAILED${RESET} — a --compile regression is present\n`);
    process.exit(1);
  }
  console.log(`${GREEN}✅ COMPILE SMOKE PASSED${RESET} (${checks.length}/${checks.length})\n`);
  process.exit(0);
}

main();
