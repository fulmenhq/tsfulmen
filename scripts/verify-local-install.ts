#!/usr/bin/env tsx
/**
 * Pre-Publish Local Install Verification
 *
 * This script verifies that the package works correctly when installed via npm
 * by testing runtime path resolution and catalog loading in an isolated environment.
 *
 * CRITICAL: This test catches path resolution bugs that only manifest in installed
 * packages, not during development. It must pass before publishing to npm.
 *
 * Process:
 * 1. Pack the package into a tarball (npm pack)
 * 2. Install tarball to temporary directory
 * 3. Import and test catalog loading from installed package
 * 4. Verify all critical runtime functionality
 * 5. Clean up temp directory
 *
 * Exit codes:
 * 0 - All tests passed, safe to publish
 * 1 - Tests failed, DO NOT publish
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

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
  try {
    await fn();
    return { name, passed: true };
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log(`\n${YELLOW}📦 Pre-Publish Local Install Verification${RESET}\n`);

  const results: TestResult[] = [];
  let tempDir: string | null = null;
  let tarballPath: string | null = null;

  try {
    // Step 1: Pack the package
    console.log("1️⃣  Packing package...");
    const { stdout } = await execAsync("npm pack --quiet");
    tarballPath = stdout.trim();
    console.log(`   ✅ Created: ${tarballPath}\n`);

    // Step 2: Create temp directory
    console.log("2️⃣  Creating temporary test directory...");
    tempDir = await mkdtemp(join(tmpdir(), "tsfulmen-verify-"));
    console.log(`   ✅ Created: ${tempDir}\n`);

    // Step 3: Install tarball to temp directory
    console.log("3️⃣  Installing package from tarball...");
    await execAsync(`cd "${tempDir}" && npm install --no-save "${join(process.cwd(), tarballPath)}"`, {
      cwd: tempDir,
    });
    console.log("   ✅ Installed successfully\n");

    // Step 4: Create test script in temp directory
    console.log("4️⃣  Running runtime tests...\n");

    const testScript = `
import { getSignal, listSignals, getSignalCatalog } from '@fulmenhq/tsfulmen/foundry';
import { loadPatternCatalog } from '@fulmenhq/tsfulmen/foundry';

async function testCatalogLoading() {
  // Test 1: Signal catalog loading (PRIMARY TEST FOR v0.1.10 FIX)
  // This is the catalog that was broken in v0.1.9 due to path resolution
  const signals = await listSignals();
  if (signals.length === 0) {
    throw new Error('Signal catalog loaded but returned no signals');
  }

  const sigterm = await getSignal('SIGTERM');
  if (!sigterm) {
    throw new Error('SIGTERM signal not found in catalog');
  }

  // Verify signal has expected structure (just check it's an object with some properties)
  if (typeof sigterm !== 'object' || Object.keys(sigterm).length === 0) {
    throw new Error('SIGTERM signal has invalid structure');
  }

  // Test 2: Get full signal catalog with version
  const catalog = await getSignalCatalog();
  if (!catalog.version) {
    throw new Error('Signal catalog missing version field');
  }
  if (!catalog.signals || catalog.signals.length === 0) {
    throw new Error('Signal catalog has no signals array');
  }
  if (!catalog.behaviors || catalog.behaviors.length === 0) {
    throw new Error('Signal catalog has no behaviors array');
  }

  // Test 3: Pattern catalog loading (verifies main foundry loader too)
  const patterns = await loadPatternCatalog();
  if (!patterns.patterns || patterns.patterns.length === 0) {
    throw new Error('Pattern catalog loaded but returned no patterns');
  }

  console.log(JSON.stringify({
    success: true,
    signalsCount: signals.length,
    behaviorsCount: catalog.behaviors.length,
    patternsCount: patterns.patterns.length,
    catalogVersion: catalog.version,
    sigtermId: sigterm.id || 'SIGTERM'
  }));
}

testCatalogLoading().catch(err => {
  console.error(JSON.stringify({
    success: false,
    error: err.message,
    stack: err.stack
  }));
  process.exit(1);
});
`;

    await writeFile(join(tempDir, "test.mjs"), testScript);

    // Run the test script
    const testResult = await execAsync(`node test.mjs`, { cwd: tempDir });

    try {
      const result = JSON.parse(testResult.stdout);

      if (!result.success) {
        results.push({
          name: "Runtime catalog loading",
          passed: false,
          error: result.error,
        });
      } else {
        results.push({ name: "Signal catalog path resolution (v0.1.10 fix)", passed: true });
        results.push({ name: "Signal catalog structure validation", passed: true });
        results.push({ name: "Pattern catalog path resolution", passed: true });

        console.log(`   ${GREEN}✅ Signal catalog:${RESET} ${result.signalsCount} signals, ${result.behaviorsCount} behaviors`);
        console.log(`   ${GREEN}✅ Pattern catalog:${RESET} ${result.patternsCount} patterns loaded`);
        console.log(`   ${GREEN}✅ Catalog version:${RESET} ${result.catalogVersion}`);
        console.log(`   ${GREEN}✅ SIGTERM lookup:${RESET} ID ${result.sigtermId}`);
        console.log(`   ${GREEN}✅ Path resolution:${RESET} Working correctly in installed package\n`);
      }
    } catch (parseError) {
      results.push({
        name: "Test script execution",
        passed: false,
        error: `Failed to parse test output: ${parseError}`,
      });
    }
  } catch (error) {
    console.error(`\n${RED}❌ Verification failed:${RESET}`);
    console.error(error instanceof Error ? error.message : String(error));

    results.push({
      name: "Pre-publish verification",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // Cleanup
    console.log("5️⃣  Cleaning up...");

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      console.log(`   ✅ Removed temp directory: ${tempDir}`);
    }

    if (tarballPath) {
      await rm(tarballPath, { force: true });
      console.log(`   ✅ Removed tarball: ${tarballPath}\n`);
    }
  }

  // Print summary
  console.log(`${YELLOW}═══════════════════════════════════════${RESET}\n`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  if (failed > 0) {
    console.log(`${RED}❌ VERIFICATION FAILED${RESET}\n`);
    console.log("Failed tests:");
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`  ${RED}✗${RESET} ${result.name}`);
      if (result.error) {
        console.log(`    ${result.error}`);
      }
    }
    console.log(`\n${RED}⛔ DO NOT PUBLISH - Fix issues before publishing${RESET}\n`);
    process.exit(1);
  }

  console.log(`${GREEN}✅ ALL TESTS PASSED${RESET} (${passed}/${results.length})\n`);
  console.log(`${GREEN}✓ Package verified - Safe to publish${RESET}\n`);
  process.exit(0);
}

main();
