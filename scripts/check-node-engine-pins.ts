#!/usr/bin/env tsx
/**
 * Fail if Node.js pins drift from the security floor.
 *
 * Checks only: package.json engines.node, .nvmrc, .node-version, and the six
 * known setup-node pins (ci.yml x2, release.yml x4). Exact strings only.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_NODE_VERSION = "22.23.4";
export const REQUIRED_ENGINES_NODE = `>=${REQUIRED_NODE_VERSION}`;

const EXPECTED_SETUP_NODE: { file: string; job: string }[] = [
  { file: ".github/workflows/ci.yml", job: "quality" },
  { file: ".github/workflows/ci.yml", job: "build" },
  { file: ".github/workflows/release.yml", job: "validate" },
  { file: ".github/workflows/release.yml", job: "publish-npm" },
  { file: ".github/workflows/release.yml", job: "build-artifacts" },
  { file: ".github/workflows/release.yml", job: "verify" },
];

export type PinCheckResult = {
  ok: boolean;
  enginesFloor: string | null;
  errors: string[];
};

export function checkNodeEnginePins(root: string): PinCheckResult {
  const errors: string[] = [];
  const enginesFloor = checkEngines(root, errors);
  checkVersionFile(root, ".nvmrc", errors);
  checkVersionFile(root, ".node-version", errors);
  checkWorkflowPins(root, errors);
  return { ok: errors.length === 0, enginesFloor, errors };
}

function checkEngines(root: string, errors: string[]): string | null {
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    errors.push("missing package.json");
    return null;
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    engines?: { node?: string };
  };
  const range = pkg.engines?.node;
  if (typeof range !== "string") {
    errors.push("package.json engines.node is missing");
    return null;
  }
  if (range !== REQUIRED_ENGINES_NODE) {
    errors.push(
      `package.json engines.node must equal ${JSON.stringify(REQUIRED_ENGINES_NODE)}, got ${JSON.stringify(range)}`,
    );
  }
  return range;
}

function checkVersionFile(root: string, relative: string, errors: string[]): void {
  const path = join(root, relative);
  if (!existsSync(path)) {
    errors.push(`missing required Node pin file ${relative}`);
    return;
  }
  const value = readFileSync(path, "utf8").trim();
  if (value === "") {
    errors.push(`${relative} is empty`);
    return;
  }
  if (value !== REQUIRED_NODE_VERSION) {
    errors.push(
      `${relative} must equal ${JSON.stringify(REQUIRED_NODE_VERSION)}, got ${JSON.stringify(value)}`,
    );
  }
}

function checkWorkflowPins(root: string, errors: string[]): void {
  const byFile = new Map<string, { name: string; body: string }[]>();
  for (const file of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
    const path = join(root, file);
    if (!existsSync(path)) {
      errors.push(`missing ${file}`);
      byFile.set(file, []);
      continue;
    }
    const jobs = extractJobs(readFileSync(path, "utf8"));
    byFile.set(file, jobs);
    for (const job of jobs) {
      checkJobSetupNode(file, job, errors);
    }
  }
  for (const { file, job } of EXPECTED_SETUP_NODE) {
    const jobs = byFile.get(file) ?? [];
    const match = jobs.find((entry) => entry.name === job);
    if (!match) {
      errors.push(`missing expected job ${job} in ${file}`);
      continue;
    }
    if (!hasSetupNode(match.body)) {
      errors.push(`missing setup-node in ${file} job ${job}`);
    }
  }
}

function checkJobSetupNode(
  file: string,
  job: { name: string; body: string },
  errors: string[],
): void {
  if (!hasSetupNode(job.body)) {
    return;
  }
  const versions = [...job.body.matchAll(/^\s+node-version:\s*(.+)$/gm)].map((match) =>
    stripYamlScalar(match[1] ?? ""),
  );
  if (versions.length === 0) {
    errors.push(`${file} job ${job.name} setup-node is missing node-version`);
    return;
  }
  for (const version of versions) {
    if (version.includes("${{")) {
      errors.push(
        `${file} job ${job.name} node-version is an expression, must be literal ${JSON.stringify(REQUIRED_NODE_VERSION)}: ${JSON.stringify(version)}`,
      );
      continue;
    }
    if (version !== REQUIRED_NODE_VERSION) {
      errors.push(
        `${file} job ${job.name} node-version must equal ${JSON.stringify(REQUIRED_NODE_VERSION)}, got ${JSON.stringify(version)}`,
      );
    }
  }
}

function hasSetupNode(body: string): boolean {
  return /uses:\s*['"]?actions\/setup-node@/.test(body);
}

function extractJobs(text: string): { name: string; body: string }[] {
  const lines = text.split(/\r?\n/);
  const jobs: { name: string; body: string }[] = [];
  let inJobs = false;
  let current: { name: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (!inJobs) {
      if (/^jobs:\s*(#.*)?$/.test(line)) {
        inJobs = true;
      }
      continue;
    }
    const header = /^ {2}([A-Za-z0-9_-]+):\s*(#.*)?$/.exec(line);
    if (header?.[1]) {
      if (current) {
        jobs.push({ name: current.name, body: current.lines.join("\n") });
      }
      current = { name: header[1], lines: [] };
      continue;
    }
    current?.lines.push(line);
  }
  if (current) {
    jobs.push({ name: current.name, body: current.lines.join("\n") });
  }
  return jobs;
}

function stripYamlScalar(raw: string): string {
  return raw
    .trim()
    .replace(/\s+#.*$/, "")
    .replace(/^['"]|['"]$/g, "");
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return resolve(entry) === fileURLToPath(import.meta.url);
}

function main(): number {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = checkNodeEnginePins(root);
  if (!result.ok) {
    console.error("Node engine pin check failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }
  console.log(
    `Node engine pins OK (engines ${REQUIRED_ENGINES_NODE}, pin ${REQUIRED_NODE_VERSION})`,
  );
  return 0;
}

if (isMainModule()) {
  process.exit(main());
}
