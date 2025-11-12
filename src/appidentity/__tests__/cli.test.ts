/**
 * CLI Tests for App Identity Commands
 *
 * Tests the identity-show and identity-validate CLI commands
 * for correct output, error handling, and exit codes.
 */

import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, "../../schema/cli.ts");
const FIXTURES_DIR = join(
  __dirname,
  "../../../config/crucible-ts/repository/app-identity/fixtures",
);

/**
 * Helper to execute CLI commands and capture output/exit code
 */
function runCLI(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`bun run ${CLI_PATH} ${args}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      stdout: err.stdout?.toString("utf-8") || "",
      stderr: err.stderr?.toString("utf-8") || "",
      exitCode: err.status || 1,
    };
  }
}

describe("CLI identity-show command", () => {
  it("should show identity in pretty format", () => {
    const fixturePath = join(FIXTURES_DIR, "valid/minimal.yaml");
    const { stdout, exitCode } = runCLI(`identity-show --path ${fixturePath}`);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Application Identity:");
    expect(stdout).toContain("Binary Name: myapp");
    expect(stdout).toContain("Vendor: acmecorp");
    expect(stdout).toContain("Env Prefix: MYAPP_");
    expect(stdout).toContain("Config Name: myapp");
    expect(stdout).toContain("Minimal valid application identity");
  });

  it("should show identity in JSON format", () => {
    const fixturePath = join(FIXTURES_DIR, "valid/minimal.yaml");
    const { stdout, exitCode } = runCLI(`identity-show --path ${fixturePath} --json`);

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.app).toBeDefined();
    expect(result.app.binary_name).toBe("myapp");
    expect(result.app.vendor).toBe("acmecorp");
    expect(result.app.env_prefix).toBe("MYAPP_");
    expect(result.app.config_name).toBe("myapp");
  });

  it("should show complete identity with metadata", () => {
    const fixturePath = join(FIXTURES_DIR, "valid/complete.yaml");
    const { stdout, exitCode } = runCLI(`identity-show --path ${fixturePath}`);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Binary Name: percheron");
    expect(stdout).toContain("Vendor: fulmenhq");
    expect(stdout).toContain("Metadata:");
    expect(stdout).toContain("License: MIT");
    expect(stdout).toContain("Category: workhorse");
    expect(stdout).toContain("Telemetry: percheron");
  });

  it("should fail with FILE_NOT_FOUND exit code for missing file", () => {
    const { exitCode } = runCLI("identity-show --path /nonexistent/path/app.yaml");

    expect(exitCode).toBe(51); // EXIT_FILE_NOT_FOUND
  });

  it("should fail with DATA_INVALID exit code for invalid identity", () => {
    const fixturePath = join(FIXTURES_DIR, "invalid/missing-required.yaml");
    const { exitCode } = runCLI(`identity-show --path ${fixturePath}`);

    expect(exitCode).toBe(60); // EXIT_DATA_INVALID
  });
});

describe("CLI identity-validate command", () => {
  it("should validate valid identity successfully", () => {
    const fixturePath = join(FIXTURES_DIR, "valid/minimal.yaml");
    const { stdout, exitCode } = runCLI(`identity-validate ${fixturePath}`);

    expect(stdout).toContain("Validating application identity...");
    expect(stdout).toContain("✅ Identity is valid");
    expect(stdout).toContain("Binary: myapp");
    expect(stdout).toContain("Vendor: acmecorp");
    expect(exitCode).toBe(0); // EXIT_SUCCESS
  });

  it("should validate complete identity", () => {
    const fixturePath = join(FIXTURES_DIR, "valid/complete.yaml");
    const { stdout, exitCode } = runCLI(`identity-validate ${fixturePath}`);

    expect(stdout).toContain("✅ Identity is valid");
    expect(stdout).toContain("Binary: percheron");
    expect(stdout).toContain("Vendor: fulmenhq");
    expect(exitCode).toBe(0);
  });

  it("should reject identity with missing required fields", () => {
    const fixturePath = join(FIXTURES_DIR, "invalid/missing-required.yaml");
    const { stderr, exitCode } = runCLI(`identity-validate ${fixturePath}`);

    expect(stderr).toContain("❌ Identity validation failed");
    expect(exitCode).toBe(60); // EXIT_DATA_INVALID
  });

  it("should reject identity with invalid binary name", () => {
    const fixturePath = join(FIXTURES_DIR, "invalid/invalid-binary-name.yaml");
    const { exitCode } = runCLI(`identity-validate ${fixturePath}`);

    expect(exitCode).toBe(60); // EXIT_DATA_INVALID
  });

  it("should reject identity with invalid env prefix", () => {
    const fixturePath = join(FIXTURES_DIR, "invalid/invalid-env-prefix.yaml");
    const { exitCode } = runCLI(`identity-validate ${fixturePath}`);

    expect(exitCode).toBe(60); // EXIT_DATA_INVALID
  });

  it("should reject identity with invalid vendor", () => {
    const fixturePath = join(FIXTURES_DIR, "invalid/invalid-vendor.yaml");
    const { exitCode } = runCLI(`identity-validate ${fixturePath}`);

    expect(exitCode).toBe(60); // EXIT_DATA_INVALID
  });

  it("should reject malformed YAML", () => {
    const fixturePath = join(FIXTURES_DIR, "invalid/malformed-yaml.yaml");
    const { stderr, exitCode } = runCLI(`identity-validate ${fixturePath}`);

    expect(stderr).toContain("❌ Identity validation failed");
    expect(exitCode).not.toBe(0);
  });

  it("should fail for nonexistent file", () => {
    const { exitCode } = runCLI("identity-validate /nonexistent/app.yaml");

    expect(exitCode).toBe(51); // EXIT_FILE_NOT_FOUND
  });
});

describe("CLI exit codes", () => {
  it("identity-show should exit 0 for valid identity", () => {
    const fixturePath = join(FIXTURES_DIR, "valid/minimal.yaml");
    const { exitCode } = runCLI(`identity-show --path ${fixturePath}`);

    expect(exitCode).toBe(0);
  });

  it("identity-show should exit 51 (FILE_NOT_FOUND) for missing file", () => {
    const { exitCode } = runCLI("identity-show --path /missing.yaml");

    expect(exitCode).toBe(51);
  });

  it("identity-show should exit 60 (DATA_INVALID) for invalid schema", () => {
    const fixturePath = join(FIXTURES_DIR, "invalid/missing-required.yaml");
    const { exitCode } = runCLI(`identity-show --path ${fixturePath}`);

    expect(exitCode).toBe(60);
  });

  it("identity-validate should exit 0 for valid identity", () => {
    const fixturePath = join(FIXTURES_DIR, "valid/minimal.yaml");
    const { exitCode } = runCLI(`identity-validate ${fixturePath}`);

    expect(exitCode).toBe(0);
  });

  it("identity-validate should exit 51 (FILE_NOT_FOUND) for missing file", () => {
    const { exitCode } = runCLI("identity-validate /missing.yaml");

    expect(exitCode).toBe(51);
  });

  it("identity-validate should exit 60 (DATA_INVALID) for invalid schema", () => {
    const fixturePath = join(FIXTURES_DIR, "invalid/missing-required.yaml");
    const { exitCode } = runCLI(`identity-validate ${fixturePath}`);

    expect(exitCode).toBe(60);
  });
});
