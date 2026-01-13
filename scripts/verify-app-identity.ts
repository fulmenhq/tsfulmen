#!/usr/bin/env bun
/**
 * Verify app identity parity against Crucible snapshot
 *
 * Ensures runtime identity loading matches SSOT expectations across all
 * language implementations (Go, Python, TypeScript).
 *
 * Exit codes:
 * - 0: All parity tests passed
 * - 1: One or more parity tests failed
 * - 2: Script error (missing files, invalid snapshot)
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadIdentity } from "../src/appidentity/loader.js";
import type { Identity } from "../src/appidentity/types.js";

interface ParityTestCase {
  input_file: string;
  expected_output: Record<string, unknown>;
  validation_result: "pass" | "fail";
  expected_error?: {
    type: string;
    field?: string;
    message: string;
  };
}

interface ParitySnapshot {
  schema_version: string;
  description: string;
  test_cases: {
    valid: Record<string, ParityTestCase>;
    invalid: Record<string, ParityTestCase>;
  };
}

/**
 * Flatten nested identity to match snapshot format
 */
function flattenIdentity(identity: Identity): Record<string, unknown> {
  return {
    binary_name: identity.app.binary_name,
    vendor: identity.app.vendor,
    env_prefix: identity.app.env_prefix,
    config_name: identity.app.config_name,
    description: identity.app.description,
    metadata: identity.metadata || {},
  };
}

/**
 * Deep equality comparison for parity validation
 */
function deepEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) {
    return true;
  }

  if (typeof actual !== "object" || typeof expected !== "object") {
    return false;
  }

  if (actual === null || expected === null) {
    return actual === expected;
  }

  const actualObj = actual as Record<string, unknown>;
  const expectedObj = expected as Record<string, unknown>;

  const actualKeys = Object.keys(actualObj).sort();
  const expectedKeys = Object.keys(expectedObj).sort();

  if (actualKeys.length !== expectedKeys.length) {
    return false;
  }

  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      return false;
    }

    if (!deepEqual(actualObj[key], expectedObj[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Compare actual output with expected for a single test case
 */
function compareOutput(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): { matches: boolean; details?: string } {
  if (deepEqual(actual, expected)) {
    return { matches: true };
  }

  // Generate diff details for debugging
  const actualJson = JSON.stringify(actual, null, 2);
  const expectedJson = JSON.stringify(expected, null, 2);

  return {
    matches: false,
    details: `\nExpected:\n${expectedJson}\n\nActual:\n${actualJson}`,
  };
}

async function main() {
  console.log("🔍 Verifying app identity parity...\n");

  const baseDir = join(import.meta.dir, "..");

  // Load parity snapshot
  const snapshotPath = join(
    baseDir,
    "config/crucible-ts/repository/app-identity/parity-snapshot.json",
  );

  let snapshot: ParitySnapshot;
  try {
    const content = await readFile(snapshotPath, "utf-8");
    snapshot = JSON.parse(content);
  } catch (error) {
    console.error("❌ Failed to load parity snapshot:", (error as Error).message);
    console.error(`   Path: ${snapshotPath}`);
    process.exit(2);
  }

  console.log(`Schema version: ${snapshot.schema_version}`);
  console.log(`Description: ${snapshot.description}\n`);

  let passed = 0;
  let failed = 0;

  // Test valid cases
  console.log("Valid test cases:");
  console.log("─".repeat(60));

  for (const [name, testCase] of Object.entries(snapshot.test_cases.valid)) {
    try {
      // Resolve input file path relative to snapshot location
      const inputPath = join(
        baseDir,
        "config/crucible-ts/repository/app-identity",
        testCase.input_file,
      );

      // Load identity with skipCache to avoid cross-test pollution
      const identity = await loadIdentity({ path: inputPath, skipCache: true });

      // Flatten to match snapshot format
      const actual = flattenIdentity(identity);

      // Compare with expected output
      const comparison = compareOutput(actual, testCase.expected_output);

      if (comparison.matches) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name} - output mismatch`);
        if (comparison.details) {
          console.log(comparison.details);
        }
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} - ${(error as Error).message}`);
      failed++;
    }
  }

  // Test invalid cases
  console.log("\n\nInvalid test cases:");
  console.log("─".repeat(60));

  for (const [name, testCase] of Object.entries(snapshot.test_cases.invalid)) {
    try {
      const inputPath = join(
        baseDir,
        "config/crucible-ts/repository/app-identity",
        testCase.input_file,
      );

      // Should throw an error (skip cache to test each case independently)
      await loadIdentity({ path: inputPath, skipCache: true });

      // If we get here, validation didn't fail as expected
      console.log(`❌ ${name} - expected validation failure but succeeded`);
      failed++;
    } catch (error) {
      // Validation failure is expected for invalid cases
      const errorMsg = (error as Error).message.toLowerCase();
      const expectedType = testCase.expected_error?.type.toLowerCase() || "";

      // Error type matching with flexible patterns
      const matchesExpectedError =
        (expectedType.includes("validation") &&
          (errorMsg.includes("invalid") || errorMsg.includes("validation"))) ||
        (expectedType.includes("parse") &&
          (errorMsg.includes("yaml") ||
            errorMsg.includes("parse") ||
            errorMsg.includes("implicit map") || // YAML parser specific errors
            errorMsg.includes("syntax")));

      if (matchesExpectedError) {
        console.log(`✅ ${name} - correctly rejected`);
        passed++;
      } else {
        console.log(`❌ ${name} - rejected with unexpected error type`);
        console.log(`   Expected type: ${testCase.expected_error?.type}`);
        console.log(`   Expected message: ${testCase.expected_error?.message}`);
        console.log(`   Actual error: ${errorMsg}`);
        failed++;
      }
    }
  }

  // Summary
  console.log(`\n${"═".repeat(60)}`);
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log("\n✅ All parity tests passed - implementation matches Crucible spec");
    process.exit(0);
  } else {
    console.log("\n❌ Parity verification failed - implementation diverges from spec");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(2);
});
