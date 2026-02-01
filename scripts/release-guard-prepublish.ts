#!/usr/bin/env tsx

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    throw new Error(
      stderr.length > 0
        ? `${cmd} ${args.join(" ")}: ${stderr}`
        : `${cmd} ${args.join(" ")}: failed`,
    );
  }

  return (result.stdout ?? "").trim();
}

function readVersionFile(): string {
  try {
    return readFileSync("VERSION", "utf8").trim();
  } catch {
    throw new Error("VERSION file not found");
  }
}

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      version?: unknown;
    };
    if (typeof pkg.version !== "string" || pkg.version.length === 0) {
      throw new Error("package.json version is missing or invalid");
    }
    return pkg.version;
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`failed to read package.json version: ${err.message}`);
    }
    throw new Error("failed to read package.json version");
  }
}

function getTrackedDirtyPorcelain(): string[] {
  const porcelain = run("git", ["status", "--porcelain=v1"])
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  // Allow untracked files (e.g. dist/, coverage/) but fail if tracked files are modified.
  return porcelain.filter((line) => !line.startsWith("?? "));
}

function main() {
  // Ensure we're at repo root so VERSION/package.json paths are stable.
  const root = run("git", ["rev-parse", "--show-toplevel"]);
  process.chdir(root);

  const version = readVersionFile();
  const pkgVersion = readPackageVersion();

  if (pkgVersion !== version) {
    throw new Error(
      [
        "version mismatch between package.json and VERSION",
        `package.json: ${pkgVersion}`,
        `VERSION:      ${version}`,
        "hint: run 'make version-sync' (or 'make version-set VERSION=x.y.z')",
      ].join("\n"),
    );
  }

  const expectedTag = `v${version}`;

  const dirty = getTrackedDirtyPorcelain();
  if (dirty.length > 0) {
    throw new Error(
      [
        "refusing to publish from a dirty worktree (tracked files modified)",
        "details:",
        ...dirty,
        "hint: commit, stash, or discard tracked changes before publishing",
      ].join("\n"),
    );
  }

  // Ensure tag exists locally.
  try {
    run("git", ["rev-parse", "-q", "--verify", `refs/tags/${expectedTag}`]);
  } catch {
    throw new Error(
      [
        `expected release tag not found locally: ${expectedTag}`,
        "hint: create the signed tag (make release-tag) or fetch tags before publishing",
      ].join("\n"),
    );
  }

  const head = run("git", ["rev-parse", "HEAD"]);
  const tagTarget = run("git", ["rev-parse", `${expectedTag}^{}`]);

  if (head !== tagTarget) {
    throw new Error(
      [
        "HEAD does not match the release tag target",
        `tag:        ${expectedTag}`,
        `tag target: ${tagTarget}`,
        `HEAD:       ${head}`,
        "hint: checkout the tagged commit before publishing",
      ].join("\n"),
    );
  }

  process.stdout.write(`OK: prepublish guard: clean + tag/version aligned (${expectedTag})\n`);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}
