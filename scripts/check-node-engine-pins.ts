#!/usr/bin/env tsx
/**
 * Fail if Node.js pins drift apart or fall below the security floor.
 *
 * Source of truth: package.json engines.node lower bound.
 * Exact pins (.nvmrc, .node-version, volta, CI setup-node, Docker FROM node)
 * must match that floor. Optional pins are checked only when present.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Node.js 22 (Jod LTS) security release verified against nodejs.org/dist/index.json. */
export const REQUIRED_NODE_FLOOR = "22.23.4";

export type NodePin = {
  source: string;
  version: string;
};

export type PinCheckResult = {
  ok: boolean;
  enginesFloor: string | null;
  pins: NodePin[];
  errors: string[];
};

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)\b/;
const SEMVER_PREFIX = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/;

export function compareSemver(a: string, b: string): number {
  const pa = parseSemverParts(a);
  const pb = parseSemverParts(b);
  if (!pa || !pb) {
    throw new Error(`Invalid semver compare: ${a} vs ${b}`);
  }
  for (let i = 0; i < 3; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av !== bv) {
      return av - bv;
    }
  }
  return 0;
}

export function normalizeNodeVersion(raw: string): string | null {
  const match = raw.trim().match(SEMVER);
  if (!match) {
    return null;
  }
  return `${match[1]}.${match[2]}.${match[3]}`;
}

export function parseEnginesNodeFloors(range: string): string[] {
  const clauses = range.split(/\s*\|\|\s*/);
  const floors: string[] = [];
  for (const clause of clauses) {
    const ge = clause.match(/>=\s*v?(\d+\.\d+\.\d+)/);
    if (ge?.[1]) {
      floors.push(ge[1]);
      continue;
    }
    const exact = normalizeNodeVersion(clause);
    if (exact) {
      floors.push(exact);
    }
  }
  return floors;
}

export function collectNodePins(root: string): NodePin[] {
  const pins: NodePin[] = [];
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      engines?: { node?: string };
      volta?: { node?: string };
    };
    if (typeof pkg.volta?.node === "string") {
      const version = normalizeNodeVersion(pkg.volta.node);
      if (version) {
        pins.push({ source: "package.json volta.node", version });
      } else {
        pins.push({ source: "package.json volta.node", version: pkg.volta.node.trim() });
      }
    }
  }

  addFilePin(pins, root, ".nvmrc");
  addFilePin(pins, root, ".node-version");
  addToolVersionsPin(pins, root);
  addWorkflowPins(pins, root);
  addDockerfilePins(pins, root);
  return pins;
}

export function checkNodeEnginePins(root: string): PinCheckResult {
  const errors: string[] = [];
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    return {
      ok: false,
      enginesFloor: null,
      pins: [],
      errors: [`missing ${join(root, "package.json")}`],
    };
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    engines?: { node?: string };
  };
  const range = pkg.engines?.node;
  if (!range || typeof range !== "string") {
    return {
      ok: false,
      enginesFloor: null,
      pins: [],
      errors: ["package.json engines.node is missing"],
    };
  }

  const floors = parseEnginesNodeFloors(range);
  if (floors.length === 0) {
    return {
      ok: false,
      enginesFloor: null,
      pins: [],
      errors: [`package.json engines.node ${JSON.stringify(range)} has no parseable >= floor`],
    };
  }

  const enginesFloor = floors[0] ?? null;
  if (!enginesFloor) {
    return {
      ok: false,
      enginesFloor: null,
      pins: [],
      errors: [`package.json engines.node ${JSON.stringify(range)} has no parseable >= floor`],
    };
  }

  for (const floor of floors) {
    if (compareSemver(floor, REQUIRED_NODE_FLOOR) < 0) {
      errors.push(
        `package.json engines.node floor ${floor} is below required ${REQUIRED_NODE_FLOOR}`,
      );
    }
  }

  for (const name of [".nvmrc", ".node-version"] as const) {
    if (!existsSync(join(root, name))) {
      errors.push(`missing required Node pin file ${name}`);
    }
  }

  const pins = collectNodePins(root);
  for (const pin of pins) {
    const version = normalizeNodeVersion(pin.version);
    if (!version) {
      errors.push(`${pin.source} is not an exact x.y.z pin: ${JSON.stringify(pin.version)}`);
      continue;
    }
    if (compareSemver(version, REQUIRED_NODE_FLOOR) < 0) {
      errors.push(`${pin.source} ${version} is below required ${REQUIRED_NODE_FLOOR}`);
    }
    if (version !== enginesFloor) {
      errors.push(`${pin.source} ${version} does not match engines.node floor ${enginesFloor}`);
    }
  }

  return {
    ok: errors.length === 0,
    enginesFloor,
    pins,
    errors,
  };
}

function parseSemverParts(raw: string): [number, number, number] | null {
  const match = raw.trim().match(SEMVER_PREFIX);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function addFilePin(pins: NodePin[], root: string, relative: string): void {
  const path = join(root, relative);
  if (!existsSync(path)) {
    return;
  }
  const version = readVersionFile(path);
  if (version) {
    pins.push({ source: relative, version });
  }
}

function readVersionFile(path: string): string | null {
  const line = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry && !entry.startsWith("#"));
  if (!line) {
    return null;
  }
  return normalizeNodeVersion(line) ?? line;
}

function addToolVersionsPin(pins: NodePin[], root: string): void {
  const path = join(root, ".tool-versions");
  if (!existsSync(path)) {
    return;
  }
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = raw.trim().match(/^(nodejs|node)\s+(\S+)/);
    if (!match?.[2]) {
      continue;
    }
    const version = normalizeNodeVersion(match[2]) ?? match[2];
    pins.push({ source: ".tool-versions", version });
  }
}

function addWorkflowPins(pins: NodePin[], root: string): void {
  const workflowsDir = join(root, ".github", "workflows");
  if (!existsSync(workflowsDir)) {
    return;
  }
  for (const name of readdirSync(workflowsDir)) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) {
      continue;
    }
    const relative = `.github/workflows/${name}`;
    const text = readFileSync(join(workflowsDir, name), "utf8");
    addYamlVersionPins(pins, relative, text, "NODE_VERSION");
    addYamlVersionPins(pins, relative, text, "node-version");
    addNodeVersionFilePins(pins, root, relative, text);
  }
}

function addYamlVersionPins(pins: NodePin[], source: string, text: string, key: string): void {
  const pattern = new RegExp(`^\\s*${key}:\\s*(.+)\\s*$`, "gm");
  for (const match of text.matchAll(pattern)) {
    const raw = stripYamlScalar(match[1] ?? "");
    if (!raw || raw.includes("${{")) {
      continue;
    }
    const version = normalizeNodeVersion(raw);
    if (!version) {
      continue;
    }
    pins.push({ source: `${source} ${key}`, version });
  }
}

function addNodeVersionFilePins(pins: NodePin[], root: string, source: string, text: string): void {
  const pattern = /^\s*node-version-file:\s*(.+)\s*$/gm;
  for (const match of text.matchAll(pattern)) {
    const relative = stripYamlScalar(match[1] ?? "");
    if (!relative) {
      continue;
    }
    const path = join(root, relative);
    if (!existsSync(path)) {
      pins.push({ source: `${source} node-version-file`, version: relative });
      continue;
    }
    const version = readVersionFile(path);
    if (version) {
      pins.push({ source: `${source} node-version-file (${relative})`, version });
    }
  }
}

function addDockerfilePins(pins: NodePin[], root: string): void {
  for (const relative of findDockerfiles(root)) {
    const text = readFileSync(join(root, relative), "utf8");
    for (const match of text.matchAll(/^FROM\s+(?:--\S+\s+)*(?:[^\s/]+\/)?node:([^\s@]+)/gm)) {
      const imageTag = match[1] ?? "";
      const version = normalizeNodeVersion(imageTag) ?? imageTag.split("-")[0] ?? imageTag;
      pins.push({ source: `${relative} FROM node`, version });
    }
  }
}

function findDockerfiles(root: string, relative = ""): string[] {
  const dir = relative ? join(root, relative) : root;
  const found: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") {
      continue;
    }
    const childRelative = relative ? `${relative}/${entry}` : entry;
    const full = join(root, childRelative);
    let isDirectory = false;
    try {
      isDirectory = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDirectory) {
      found.push(...findDockerfiles(root, childRelative));
      continue;
    }
    if (
      entry === "Dockerfile" ||
      entry.startsWith("Dockerfile.") ||
      entry.endsWith(".Dockerfile")
    ) {
      found.push(childRelative);
    }
  }
  return found;
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
    `Node engine pins OK (floor ${result.enginesFloor}, required ${REQUIRED_NODE_FLOOR})`,
  );
  return 0;
}

if (isMainModule()) {
  process.exit(main());
}
