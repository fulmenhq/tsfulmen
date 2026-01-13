#!/usr/bin/env bun
/**
 * Generate checksum files for GitHub release assets.
 *
 * Creates SHA256SUMS and SHA512SUMS files for the npm tarball.
 * These provide cryptographic verification for users downloading
 * releases from GitHub instead of npm registry.
 *
 * Usage:
 *   bunx tsx scripts/generate-checksums.ts [tarball-path]
 *
 * If no path provided, looks for *.tgz in current directory.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";

const tarballArg = process.argv[2];

function run(command: string): string {
  return execSync(command, { encoding: "utf8" }).trim();
}

let tarballPath: string;

if (tarballArg) {
  if (!existsSync(tarballArg)) {
    console.error(`❌ Tarball not found: ${tarballArg}`);
    process.exit(1);
  }
  tarballPath = tarballArg;
} else {
  // Find .tgz in current directory
  const tarballs = readdirSync(".").filter((f) => f.endsWith(".tgz"));

  if (tarballs.length === 0) {
    console.error("❌ No .tgz files found in current directory");
    console.error("   Run `npm pack` first or provide tarball path");
    process.exit(1);
  }

  if (tarballs.length > 1) {
    console.error("❌ Multiple .tgz files found, please specify which one:");
    for (const t of tarballs) {
      console.error(`   ${t}`);
    }
    process.exit(1);
  }

  tarballPath = tarballs[0];
}

console.log(`📦 Generating checksums for: ${tarballPath}\n`);

try {
  // SHA-256 (industry standard)
  const sha256 = run(`shasum -a 256 ${tarballPath}`);
  writeFileSync("SHA256SUMS", `${sha256}\n`);
  console.log("✅ SHA256SUMS");
  console.log(`   ${sha256.split(/\s+/)[0]}`);

  // SHA-512 (extra security)
  const sha512 = run(`shasum -a 512 ${tarballPath}`);
  writeFileSync("SHA512SUMS", `${sha512}\n`);
  console.log("\n✅ SHA512SUMS");
  console.log(`   ${sha512.split(/\s+/)[0]}`);

  console.log("\n📋 Checksum files created:");
  console.log("   - SHA256SUMS (for GitHub releases)");
  console.log("   - SHA512SUMS (for GitHub releases)");
  console.log("\n💡 Verification instructions:");
  console.log("   shasum -a 256 -c SHA256SUMS");
  console.log("   shasum -a 512 -c SHA512SUMS");
} catch (error) {
  console.error("\n❌ Failed to generate checksums:", (error as Error).message);
  process.exit(1);
}
