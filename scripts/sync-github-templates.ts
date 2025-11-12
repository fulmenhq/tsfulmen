#!/usr/bin/env bun
/**
 * Sync GitHub templates from 3leaps/oss-policies
 *
 * This script copies and customizes GitHub issue/PR templates from the
 * canonical oss-policies repository, replacing generic placeholders with
 * TSFulmen-specific values.
 *
 * Usage: bun run scripts/sync-github-templates.ts [--dry-run]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose") || DRY_RUN;

// Paths
const OSS_POLICIES_PATH = join(homedir(), "dev", "3leaps", "oss-policies");
const SOURCE_GITHUB_DIR = join(OSS_POLICIES_PATH, ".github");
const TARGET_GITHUB_DIR = join(process.cwd(), ".github");

// Template files to sync
const TEMPLATE_FILES = [
  "ISSUE_TEMPLATE/bug_report.yml",
  "ISSUE_TEMPLATE/feature_request.yml",
  "ISSUE_TEMPLATE/question.yml",
  "ISSUE_TEMPLATE/config.yml",
  "PULL_REQUEST_TEMPLATE.md",
];

// Customization values for TSFulmen
const CUSTOMIZATIONS = {
  org: "fulmenhq",
  repo: "tsfulmen",
  projectName: "TSFulmen",
  projectDescription: "TypeScript Fulmen helper library",
};

interface SyncResult {
  file: string;
  status: "copied" | "customized" | "skipped" | "error";
  message?: string;
}

function log(message: string, level: "info" | "warn" | "error" = "info") {
  if (level === "error") {
    console.error(`❌ ${message}`);
  } else if (level === "warn") {
    console.warn(`⚠️  ${message}`);
  } else if (VERBOSE) {
    console.log(`ℹ️  ${message}`);
  }
}

function checkOssPoliciesAvailable(): boolean {
  if (!existsSync(SOURCE_GITHUB_DIR)) {
    console.error(
      `❌ Error: oss-policies not found at ${OSS_POLICIES_PATH}\n\n` +
        `Please clone the repository:\n` +
        `  git clone https://github.com/3leaps/oss-policies.git ~/dev/3leaps/oss-policies\n`,
    );
    return false;
  }
  return true;
}

function customizeContent(content: string, filename: string): string {
  let customized = content;

  // Replace placeholder URLs
  customized = customized
    .replace(/YOUR_ORG\/YOUR_REPO/g, `${CUSTOMIZATIONS.org}/${CUSTOMIZATIONS.repo}`)
    .replace(/YOUR_ORG/g, CUSTOMIZATIONS.org)
    .replace(/YOUR_REPO/g, CUSTOMIZATIONS.repo);

  // File-specific customizations
  if (filename.includes("bug_report.yml")) {
    // Customize bug report for TSFulmen
    customized = customized
      .replace(
        "description: Report a bug or unexpected behavior",
        `description: Report a bug or unexpected behavior in ${CUSTOMIZATIONS.projectName}`,
      )
      .replace("label: Version", `label: ${CUSTOMIZATIONS.projectName} Version`)
      .replace("placeholder: e.g., 0.1.3", "placeholder: e.g., 0.1.4")
      .replace(
        "placeholder: e.g., Node.js v20.11.0, Go 1.22, Python 3.11",
        "placeholder: e.g., Node.js v20.11.0 or Bun v1.0.25",
      )
      .replace(
        "- label: I am using a supported version",
        `- label: I am using a supported version of ${CUSTOMIZATIONS.projectName} (v0.1.x alpha)`,
      );

    // Add TSFulmen-specific runtime environment dropdown
    customized = customized.replace(
      "  - type: input\n    id: environment\n    attributes:\n      label: Environment\n      description: Runtime/language version and environment details\n      placeholder: e.g., Node.js v20.11.0, Go 1.22, Python 3.11\n    validations:\n      required: true",
      `  - type: dropdown
    id: runtime
    attributes:
      label: Runtime Environment
      description: Which runtime are you using?
      options:
        - Node.js
        - Bun
        - Other (please specify in additional context)
    validations:
      required: true

  - type: input
    id: runtime-version
    attributes:
      label: Runtime Version
      description: Which version of Node.js/Bun are you using?
      placeholder: e.g., Node.js v20.11.0 or Bun v1.0.25
    validations:
      required: true`,
    );
  }

  if (filename.includes("feature_request.yml")) {
    // Add TSFulmen module dropdown
    const moduleDropdown = `
  - type: dropdown
    id: module
    attributes:
      label: Related Module
      description: Which ${CUSTOMIZATIONS.projectName} module is this feature related to?
      options:
        - config (Config Path API)
        - crucible (Crucible Shim)
        - docscribe (Document Processing)
        - errors (Error Handling)
        - foundry (Pattern Catalogs & HTTP)
        - fulhash (Fast Hashing)
        - logging (Progressive Logging)
        - pathfinder (Filesystem Traversal)
        - schema (Schema Validation)
        - telemetry (Metrics & Observability)
        - other (New module or cross-cutting)

`;

    // Insert module dropdown after "problem" section
    customized = customized.replace(
      /(\n  - type: textarea\n    id: solution)/,
      `${moduleDropdown}$1`,
    );

    // Add alpha status note
    customized = customized.replace(
      "Thanks for suggesting a feature! Please provide details below to help us understand your request.",
      `Thanks for suggesting a feature! Please provide details below to help us understand your request.\n\n        **Note**: ${CUSTOMIZATIONS.projectName} is currently in alpha (v0.1.x). We're focusing on core module stability before adding major new features.`,
    );
  }

  if (filename.includes("question.yml")) {
    // Add TSFulmen module dropdown
    const moduleDropdown = `
  - type: dropdown
    id: module
    attributes:
      label: Related Module (if applicable)
      description: Which ${CUSTOMIZATIONS.projectName} module is your question about?
      options:
        - General / Not module-specific
        - config (Config Path API)
        - crucible (Crucible Shim)
        - docscribe (Document Processing)
        - errors (Error Handling)
        - foundry (Pattern Catalogs & HTTP)
        - fulhash (Fast Hashing)
        - logging (Progressive Logging)
        - pathfinder (Filesystem Traversal)
        - schema (Schema Validation)
        - telemetry (Metrics & Observability)

`;

    customized = customized.replace(
      /(\n  - type: textarea\n    id: context)/,
      `${moduleDropdown}$1`,
    );
  }

  if (filename.includes("PULL_REQUEST_TEMPLATE")) {
    // Add TSFulmen-specific quality checks and note about alpha status
    customized = customized.replace(
      "- [ ] Project-specific quality checks pass (lint, format, test)",
      "- [ ] `make check-all` passes (lint, typecheck, test)",
    );

    // Add alpha status note at the end
    customized = customized.replace(
      "<!-- Any additional information that reviewers should know -->",
      `<!-- Any additional information that reviewers should know -->\n\n---\n\n**Note**: ${CUSTOMIZATIONS.projectName} is currently in alpha (v0.1.x). We are focusing on core stability and are not yet accepting feature PRs unless pre-approved. For feature requests, please open an issue first to discuss.`,
    );
  }

  if (filename.includes("config.yml")) {
    // Customize config.yml URLs
    customized = customized
      .replace(
        "about: Read the project documentation and examples",
        `about: Read the ${CUSTOMIZATIONS.projectName} documentation and examples`,
      )
      .replace(
        "about: Ask questions and discuss with the community",
        `about: Ask questions and discuss ${CUSTOMIZATIONS.projectName} with the community`,
      );
  }

  return customized;
}

function syncTemplate(filename: string): SyncResult {
  const sourcePath = join(SOURCE_GITHUB_DIR, filename);
  const targetPath = join(TARGET_GITHUB_DIR, filename);

  try {
    // Check if source exists
    if (!existsSync(sourcePath)) {
      return {
        file: filename,
        status: "error",
        message: `Source file not found: ${sourcePath}`,
      };
    }

    // Read source content
    const sourceContent = readFileSync(sourcePath, "utf-8");

    // Customize content
    const customizedContent = customizeContent(sourceContent, filename);

    // Create target directory if needed
    const targetDir = dirname(targetPath);
    if (!DRY_RUN && !existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Write target file
    if (!DRY_RUN) {
      writeFileSync(targetPath, customizedContent, "utf-8");
    }

    log(`Synced: ${filename}`, "info");
    return {
      file: filename,
      status: "customized",
      message: DRY_RUN ? "Would sync (dry run)" : "Synced successfully",
    };
  } catch (error) {
    log(`Failed to sync ${filename}: ${error}`, "error");
    return {
      file: filename,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function main() {
  console.log(`\n🔄 Syncing GitHub templates from oss-policies...\n`);

  if (DRY_RUN) {
    console.log("🧪 DRY RUN MODE - No files will be modified\n");
  }

  // Check oss-policies availability
  if (!checkOssPoliciesAvailable()) {
    process.exit(1);
  }

  // Sync all templates
  const results: SyncResult[] = [];
  for (const templateFile of TEMPLATE_FILES) {
    const result = syncTemplate(templateFile);
    results.push(result);
  }

  // Report results
  console.log(`\n📊 Sync Results:\n`);

  const successful = results.filter((r) => r.status === "customized");
  const failed = results.filter((r) => r.status === "error");

  console.log(`✅ Successfully synced: ${successful.length} files`);
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length} files`);
    failed.forEach((r) => {
      console.log(`   - ${r.file}: ${r.message}`);
    });
  }

  console.log(
    `\n✨ GitHub templates synced from 3leaps/oss-policies and customized for ${CUSTOMIZATIONS.projectName}\n`,
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
