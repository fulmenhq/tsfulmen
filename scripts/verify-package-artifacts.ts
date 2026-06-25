#!/usr/bin/env bun
/**
 * Pre-publish artifact verification for @fulmenhq/tsfulmen.
 *
 * Verifies that npm pack produces correct artifacts with:
 * - All module entry points (JS + .d.ts)
 * - Runtime SSOT assets (config, schemas)
 * - Package integrity hashes
 * - Correct package.json exports
 *
 * Usage:
 *   bunx tsx scripts/verify-package-artifacts.ts
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";

// Must stay in sync with package.json#exports (every public subpath is verified
// to ship JS + .d.ts + an exports entry). Keep this list == the exports keys.
const EXPECTED_MODULES = [
  "index",
  "appidentity",
  "assets",
  "config",
  "crucible",
  "crucible/fulpack",
  "docscribe",
  "errors",
  "foundry",
  "foundry/similarity",
  "fulencode",
  "fulhash",
  "fulpack",
  "logging",
  "pathfinder",
  "schema",
  "signals",
  "similarity",
  "telemetry",
  "telemetry/http",
  "telemetry/prometheus",
];

let exitCode = 0;
let tarballPath = "";

function run(command: string): string {
  return execSync(command, { encoding: "utf8" });
}

function listTarball(pattern: string): string[] {
  try {
    const result = run(`tar -tzf ${tarballPath} | grep "${pattern}"`).trim();
    return result ? result.split("\n").filter(Boolean) : [];
  } catch {
    // TECHNICAL DEBT: grep exits with code 1 when no matches found.
    // This conflates "no matches" with "operation failed".
    // TODO: Replace with fulpack module (see .plans/fulmenhq/archive-module-requirements.md)
    return [];
  }
}

try {
  console.log("📦 Creating npm package tarball...\n");
  const packOutput = run("npm pack");
  const lastLine = packOutput.trim().split("\n").pop();
  if (!lastLine) {
    throw new Error("npm pack produced no output");
  }
  tarballPath = lastLine.trim();

  if (!existsSync(tarballPath)) {
    throw new Error(`Tarball not found: ${tarballPath}`);
  }

  console.log(`✅ Tarball created: ${tarballPath}\n`);

  // Verify integrity hashes
  console.log("🔐 Checking package integrity...");
  const dryRunOutput = run("npm pack --dry-run 2>&1");
  const shaMatch = dryRunOutput.match(/shasum:\s+([a-f0-9]{40})/);
  const integrityMatch = dryRunOutput.match(/integrity:\s+(sha512-[A-Za-z0-9+/=]+)/);

  if (!shaMatch || !integrityMatch) {
    throw new Error("Missing integrity hashes in pack output");
  }

  console.log(`  ✅ SHA-1: ${shaMatch[1]}`);
  console.log(
    `  ✅ SHA-256: ${
      run(`shasum -a 256 ${tarballPath}`)
        .trim()
        .match(/^([a-f0-9]{64})/)?.[1]
    }`,
  );
  console.log(`  ✅ SHA-512: ${integrityMatch[1].substring(0, 30)}...`);

  // Verify module artifacts
  console.log("\n📂 Verifying module artifacts...");
  const jsFiles = listTarball("package/dist/.*index\\.js$");
  const dtsFiles = listTarball("package/dist/.*index\\.d\\.ts$");

  let missingModules = 0;
  for (const module of EXPECTED_MODULES) {
    const jsPath = module === "index" ? `package/dist/index.js` : `package/dist/${module}/index.js`;
    const dtsPath =
      module === "index" ? `package/dist/index.d.ts` : `package/dist/${module}/index.d.ts`;

    const hasJs = jsFiles.some((f) => f === jsPath);
    const hasDts = dtsFiles.some((f) => f === dtsPath);

    if (!hasJs || !hasDts) {
      console.error(`  ❌ Missing: ${module} (JS: ${hasJs}, .d.ts: ${hasDts})`);
      missingModules++;
    } else {
      console.log(`  ✅ ${module}`);
    }
  }

  if (missingModules > 0) {
    throw new Error(`${missingModules} modules missing artifacts`);
  }

  // Verify runtime assets
  console.log("\n📚 Verifying runtime SSOT assets...");
  const configFiles = listTarball("package/config/crucible-ts");
  const schemaFiles = listTarball("package/schemas/crucible-ts");

  console.log(`  ✅ Config files: ${configFiles.length}`);
  console.log(`  ✅ Schema files: ${schemaFiles.length}`);

  if (configFiles.length === 0 || schemaFiles.length === 0) {
    throw new Error("Missing runtime SSOT assets");
  }

  // Verify package.json exports
  console.log("\n🔍 Verifying package.json exports...");
  run(`tar -xzf ${tarballPath} package/package.json`);
  const pkgJson = JSON.parse(readFileSync("package/package.json", "utf8"));

  let missingExports = 0;
  for (const module of EXPECTED_MODULES) {
    const exportKey = module === "index" ? "." : `./${module}`;
    const exportDef = pkgJson.exports[exportKey];

    if (!exportDef?.import || !exportDef?.types) {
      console.error(`  ❌ Missing export: ${exportKey}`);
      missingExports++;
    } else {
      console.log(`  ✅ ${exportKey}`);
    }
  }

  if (missingExports > 0) {
    throw new Error(`${missingExports} modules missing package.json exports`);
  }

  // Verify VERSION constant consistency
  console.log("\n🔍 Verifying version consistency...");
  const pkgVersion = pkgJson.version;

  // Extract VERSION constant from dist/index.js.
  // tsup deduplicates colliding top-level `VERSION` consts by appending a
  // numeric suffix (VERSION, VERSION2, ...), and which slot the package VERSION
  // lands in shifts as the module graph changes. Match any `VERSION\d*` (the \b
  // excludes FULPACK_VERSION etc.) and require the package version to be present,
  // rather than hard-coding a specific suffix.
  run(`tar -xzf ${tarballPath} package/dist/index.js`);
  const distIndex = readFileSync("package/dist/index.js", "utf8");
  const exportedVersions = [...distIndex.matchAll(/\bVERSION\d* = "([^"]+)"/g)].map((m) => m[1]);

  if (exportedVersions.length === 0) {
    throw new Error("Could not find a VERSION constant in dist/index.js");
  }

  if (!exportedVersions.includes(pkgVersion)) {
    throw new Error(
      `VERSION mismatch: package.json=${pkgVersion}, exported=[${exportedVersions.join(", ")}]`,
    );
  }

  console.log(`  ✅ Version consistency: ${pkgVersion}`);

  // Summary
  const totalFiles = listTarball("").length;
  console.log("\n📊 Package Summary:");
  console.log(`  Total files: ${totalFiles}`);
  console.log(`  Modules: ${EXPECTED_MODULES.length}`);
  console.log(`  Config assets: ${configFiles.length}`);
  console.log(`  Schema assets: ${schemaFiles.length}`);

  console.log("\n✅ All artifact verification checks PASSED");
} catch (error) {
  console.error("\n❌ Artifact verification FAILED:", (error as Error).message);
  exitCode = 1;
} finally {
  // Cleanup
  if (tarballPath && existsSync(tarballPath)) {
    rmSync(tarballPath, { force: true });
  }
  if (existsSync("package")) {
    rmSync("package", { recursive: true, force: true });
  }
}

process.exit(exitCode);
