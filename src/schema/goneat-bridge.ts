/**
 * Goneat bridge - Optional integration for CLI-only goneat validation
 *
 * Provides goneat validation as an opt-in alternative for CLI exploration.
 * NOT used by library consumers - AJV validation is the primary implementation.
 */

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import type { SchemaValidationDiagnostic, SchemaValidationResult } from "./types.js";
import { createDiagnostic } from "./utils.js";

/**
 * Goneat validation output structure
 */
interface GoneatValidationOutput {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    keyword?: string;
  }>;
}

/**
 * Detect goneat binary location
 */
export async function detectGoneat(customPath?: string): Promise<string | null> {
  // Try custom path first
  if (customPath) {
    try {
      await access(customPath);
      return customPath;
    } catch {
      return null;
    }
  }

  // Try GONEAT_PATH environment variable
  if (process.env.GONEAT_PATH) {
    try {
      await access(process.env.GONEAT_PATH);
      return process.env.GONEAT_PATH;
    } catch {
      // Continue to next option
    }
  }

  // Try local bin/goneat
  try {
    await access("./bin/goneat");
    return "./bin/goneat";
  } catch {
    // Continue to next option
  }

  // Try system PATH (assume 'goneat' command available)
  return "goneat";
}

/**
 * Check if goneat is available
 *
 * If goneatPath is provided, use it directly to test availability.
 * Otherwise, detect goneat location first.
 */
export async function isGoneatAvailable(goneatPath?: string): Promise<boolean> {
  let pathToTest: string | null;

  if (goneatPath) {
    // Use provided path directly - don't re-detect
    // This allows testing 'goneat' command from PATH
    pathToTest = goneatPath;
  } else {
    // Detect goneat location
    pathToTest = await detectGoneat();
    if (!pathToTest) return false;
  }

  return new Promise((resolve) => {
    const proc = spawn(pathToTest as string, ["version"], { stdio: "ignore" });

    // Timeout after 5 seconds to prevent hanging in CI
    const timeout = setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);

    proc.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });
    proc.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

/**
 * Run goneat schema validation (CLI-only, opt-in)
 *
 * This is NOT used by library validation - it's purely for CLI comparison.
 * Library users get full AJV validation without goneat dependency.
 */
export async function runGoneatValidation(
  schemaPath: string,
  dataPath: string,
  goneatPath?: string,
): Promise<SchemaValidationResult> {
  const detected = await detectGoneat(goneatPath);

  if (!detected) {
    return {
      valid: false,
      diagnostics: [
        createDiagnostic(
          "",
          "goneat binary not found. Install goneat or specify path with --goneat-path",
          "goneat-unavailable",
          "ERROR",
          "goneat",
        ),
      ],
      source: "goneat",
    };
  }

  // Check availability using the detected path directly
  if (!(await isGoneatAvailable(detected))) {
    return {
      valid: false,
      diagnostics: [
        createDiagnostic(
          "",
          `goneat binary found at '${detected}' but not executable or version check failed`,
          "goneat-not-executable",
          "ERROR",
          "goneat",
        ),
      ],
      source: "goneat",
    };
  }

  return new Promise((resolve) => {
    const args = [
      "schema",
      "validate",
      "--schema",
      schemaPath,
      "--data",
      dataPath,
      "--format",
      "json",
    ];
    const proc = spawn(detected, args);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number | null) => {
      // Parse goneat output
      let output: GoneatValidationOutput;

      try {
        output = JSON.parse(stdout) as GoneatValidationOutput;
      } catch {
        // Failed to parse output, treat as error
        resolve({
          valid: false,
          diagnostics: [
            createDiagnostic(
              "",
              `goneat validation failed: ${stderr || "unknown error"}`,
              "goneat-error",
              "ERROR",
              "goneat",
            ),
          ],
          source: "goneat",
        });
        return;
      }

      // Convert goneat errors to our diagnostic format
      const diagnostics: SchemaValidationDiagnostic[] =
        output.errors?.map((error) =>
          createDiagnostic(
            error.path || "",
            error.message,
            error.keyword || "validation",
            "ERROR",
            "goneat",
          ),
        ) || [];

      resolve({
        valid: code === 0 && output.valid,
        diagnostics,
        source: "goneat",
      });
    });

    proc.on("error", (error) => {
      resolve({
        valid: false,
        diagnostics: [
          createDiagnostic(
            "",
            `Failed to execute goneat: ${error.message}`,
            "goneat-spawn-error",
            "ERROR",
            "goneat",
          ),
        ],
        source: "goneat",
      });
    });
  });
}
