#!/usr/bin/env tsx
/**
 * Fail if Node.js pins drift from the security floor.
 *
 * Checks only: package.json engines.node, .nvmrc, .node-version, and the six
 * known setup-node pins (ci.yml x2, release.yml x4). Exact strings only.
 * Workflows are parsed with yaml so comments and indentation cannot hide steps.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

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
  const jobsByFile = new Map<string, Record<string, unknown>>();
  for (const file of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
    const path = join(root, file);
    if (!existsSync(path)) {
      errors.push(`missing ${file}`);
      jobsByFile.set(file, {});
      continue;
    }
    let parsed: unknown;
    try {
      parsed = parseYaml(readFileSync(path, "utf8"));
    } catch (err) {
      errors.push(`${file} is not valid YAML: ${String(err)}`);
      jobsByFile.set(file, {});
      continue;
    }
    const jobs = workflowJobs(parsed);
    jobsByFile.set(file, jobs);
    for (const [jobName, job] of Object.entries(jobs)) {
      checkJobSetupNode(file, jobName, job, errors);
    }
  }
  for (const { file, job } of EXPECTED_SETUP_NODE) {
    const jobs = jobsByFile.get(file) ?? {};
    if (!(job in jobs)) {
      errors.push(`missing expected job ${job} in ${file}`);
      continue;
    }
    if (setupNodeSteps(jobs[job]).length === 0) {
      errors.push(`missing setup-node in ${file} job ${job}`);
    }
  }
}

function checkJobSetupNode(file: string, jobName: string, job: unknown, errors: string[]): void {
  for (const step of setupNodeSteps(job)) {
    const withBlock = step.with;
    if (withBlock === null || typeof withBlock !== "object" || Array.isArray(withBlock)) {
      errors.push(`${file} job ${jobName} setup-node is missing with`);
      continue;
    }
    const fields = withBlock as Record<string, unknown>;
    if (fields["node-version-file"] != null) {
      errors.push(
        `${file} job ${jobName} setup-node uses node-version-file; must set literal node-version ${JSON.stringify(REQUIRED_NODE_VERSION)}`,
      );
    }
    const pin = fields["node-version"];
    if (typeof pin !== "string") {
      errors.push(
        `${file} job ${jobName} setup-node is missing a literal node-version ${JSON.stringify(REQUIRED_NODE_VERSION)}`,
      );
      continue;
    }
    if (pin.includes("${{")) {
      errors.push(
        `${file} job ${jobName} node-version is an expression, must be literal ${JSON.stringify(REQUIRED_NODE_VERSION)}: ${JSON.stringify(pin)}`,
      );
      continue;
    }
    if (pin !== REQUIRED_NODE_VERSION) {
      errors.push(
        `${file} job ${jobName} node-version must equal ${JSON.stringify(REQUIRED_NODE_VERSION)}, got ${JSON.stringify(pin)}`,
      );
    }
  }
}

function workflowJobs(parsed: unknown): Record<string, unknown> {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const jobs = (parsed as { jobs?: unknown }).jobs;
  if (jobs === null || typeof jobs !== "object" || Array.isArray(jobs)) {
    return {};
  }
  return jobs as Record<string, unknown>;
}

function setupNodeSteps(job: unknown): Record<string, unknown>[] {
  if (job === null || typeof job !== "object" || Array.isArray(job)) {
    return [];
  }
  const steps = (job as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps.filter((step): step is Record<string, unknown> => {
    if (step === null || typeof step !== "object" || Array.isArray(step)) {
      return false;
    }
    const uses = (step as { uses?: unknown }).uses;
    return typeof uses === "string" && uses.startsWith("actions/setup-node");
  });
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
