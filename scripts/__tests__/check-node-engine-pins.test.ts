import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkNodeEnginePins,
  REQUIRED_ENGINES_NODE,
  REQUIRED_NODE_VERSION,
} from "../check-node-engine-pins.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const CI_JOBS = ["quality", "build"] as const;
const RELEASE_JOBS = ["validate", "publish-npm", "build-artifacts", "verify"] as const;

describe("check-node-engine-pins", () => {
  it("keeps the required floor on the verified Node.js 22 security release", () => {
    expect(REQUIRED_NODE_VERSION).toBe("22.23.4");
    expect(REQUIRED_ENGINES_NODE).toBe(">=22.23.4");
  });

  it("passes for the repository pins", () => {
    const result = checkNodeEnginePins(REPO_ROOT);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.enginesFloor).toBe(REQUIRED_ENGINES_NODE);
  });

  it("fails when engines.node is not the exact floor string", () => {
    const cases = ["22.23.4-rc.1", ">=22.23.4-rc.1", ">=22.23.4.x", ">=22.23.4 || *", ">=22.12.0"];
    for (const engines of cases) {
      const result = checkNodeEnginePins(fixtureRepo({ engines }));
      expect(result.ok, engines).toBe(false);
      expect(
        result.errors.some((error) => error.includes("engines.node")),
        engines,
      ).toBe(true);
    }
  });

  it("fails when a version file is 22.23.4-rc.1, 22.23.4.x, or otherwise not exact", () => {
    for (const pin of ["22.23.4-rc.1", "22.23.4.x", "22.12.0"]) {
      const result = checkNodeEnginePins(fixtureRepo({ nvmrc: pin }));
      expect(result.ok, pin).toBe(false);
      expect(
        result.errors.some((error) => error.includes(".nvmrc")),
        pin,
      ).toBe(true);
    }
  });

  it("fails when .nvmrc is empty", () => {
    const result = checkNodeEnginePins(fixtureRepo({ nvmrc: "" }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes(".nvmrc") && error.includes("empty"))).toBe(
      true,
    );
  });

  it("fails when a setup-node node-version is an expression", () => {
    const result = checkNodeEnginePins(
      fixtureRepo({ ciNodeVersion: { quality: "${" + "{ matrix.node }}" } }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("expression"))).toBe(true);
  });

  it("fails when an expected job is missing setup-node", () => {
    const result = checkNodeEnginePins(
      fixtureRepo({ omitSetupNode: { file: "ci", job: "build" } }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("missing setup-node"))).toBe(true);
  });

  it("fails when a CI node-version pin is not the literal 22.23.4", () => {
    const result = checkNodeEnginePins(fixtureRepo({ ciNodeVersion: { quality: "22.12.0" } }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("node-version"))).toBe(true);
  });

  it("fails when a second setup-node step uses node-version-file", () => {
    const result = checkNodeEnginePins(fixtureRepo({ extraNodeVersionFile: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("node-version-file"))).toBe(true);
  });

  it("fails when a required pin file is missing", () => {
    const result = checkNodeEnginePins(fixtureRepo({ omitNvmrc: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes(".nvmrc"))).toBe(true);
  });
});

function fixtureRepo(opts?: {
  engines?: string;
  nvmrc?: string;
  omitNvmrc?: boolean;
  ciNodeVersion?: Record<string, string>;
  omitSetupNode?: { file: "ci" | "release"; job: string };
  extraNodeVersionFile?: boolean;
}): string {
  const root = mkdtempSync(join(tmpdir(), "tsfulmen-node-pins-"));
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ engines: { node: opts?.engines ?? REQUIRED_ENGINES_NODE } }, null, 2)}\n`,
  );
  if (!opts?.omitNvmrc) {
    writeFileSync(join(root, ".nvmrc"), opts?.nvmrc === undefined ? "22.23.4\n" : opts.nvmrc);
  }
  writeFileSync(join(root, ".node-version"), "22.23.4\n");
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  writeFileSync(
    join(root, ".github", "workflows", "ci.yml"),
    workflowYaml(
      "ci",
      CI_JOBS,
      opts?.ciNodeVersion,
      opts?.omitSetupNode?.file === "ci" ? opts.omitSetupNode.job : undefined,
      opts?.extraNodeVersionFile,
    ),
  );
  writeFileSync(
    join(root, ".github", "workflows", "release.yml"),
    workflowYaml(
      "release",
      RELEASE_JOBS,
      undefined,
      opts?.omitSetupNode?.file === "release" ? opts.omitSetupNode.job : undefined,
    ),
  );
  return root;
}

function workflowYaml(
  _kind: "ci" | "release",
  jobs: readonly string[],
  versions?: Record<string, string>,
  omitJob?: string,
  extraNodeVersionFile?: boolean,
): string {
  const blocks = jobs.map((job) => {
    if (job === omitJob) {
      return `  ${job}:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v5\n`;
    }
    const version = versions?.[job] ?? REQUIRED_NODE_VERSION;
    const extra =
      extraNodeVersionFile && job === "quality"
        ? [
            "      - uses: actions/setup-node@v5",
            "        with:",
            "          node-version-file: package.json",
            "",
          ]
        : [""];
    return [
      `  ${job}:`,
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/setup-node@v5",
      "        with:",
      `          node-version: "${version}"`,
      ...extra,
    ].join("\n");
  });
  return `name: test\njobs:\n${blocks.join("")}`;
}
