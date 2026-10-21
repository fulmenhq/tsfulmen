import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkNodeEnginePins,
  compareSemver,
  parseEnginesNodeFloors,
  REQUIRED_NODE_FLOOR,
} from "../check-node-engine-pins.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("check-node-engine-pins", () => {
  it("keeps the required floor on the verified Node.js 22 security release", () => {
    expect(REQUIRED_NODE_FLOOR).toBe("22.23.4");
  });

  it("parses a >= x.y.z engines floor", () => {
    expect(parseEnginesNodeFloors(">=22.23.4")).toEqual(["22.23.4"]);
  });

  it("compares patch-level semver", () => {
    expect(compareSemver("22.23.4", "22.12.0")).toBeGreaterThan(0);
    expect(compareSemver("22.12.0", "22.23.4")).toBeLessThan(0);
    expect(compareSemver("22.23.4", "22.23.4")).toBe(0);
  });

  it("passes for the repository pins", () => {
    const result = checkNodeEnginePins(REPO_ROOT);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.enginesFloor).toBe(REQUIRED_NODE_FLOOR);
  });

  it("fails when the engines floor is reverted below the security release", () => {
    const root = fixtureRepo({ engines: ">=22.12.0", pin: "22.12.0" });
    const result = checkNodeEnginePins(root);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("22.12.0"))).toBe(true);
    expect(result.errors.some((error) => error.includes(REQUIRED_NODE_FLOOR))).toBe(true);
  });

  it("fails when pin files drift apart", () => {
    const root = fixtureRepo({ engines: ">=22.23.4", pin: "22.23.4" });
    writeFileSync(join(root, ".nvmrc"), "22.12.0\n");
    const result = checkNodeEnginePins(root);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes(".nvmrc"))).toBe(true);
  });

  it("fails when a CI node-version pin falls below the floor", () => {
    const root = fixtureRepo({ engines: ">=22.23.4", pin: "22.23.4" });
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(root, ".github", "workflows", "ci.yml"),
      [
        "name: CI",
        "jobs:",
        "  quality:",
        "    steps:",
        "      - uses: actions/setup-node@v5",
        "        with:",
        '          node-version: "22.12.0"',
        "",
      ].join("\n"),
    );
    const result = checkNodeEnginePins(root);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("node-version"))).toBe(true);
  });

  it("fails when CI uses a floating Node alias instead of 22.23.4", () => {
    const aliases = ["22", "22.x", "lts/jod"];
    for (const alias of aliases) {
      const root = fixtureRepo({ engines: ">=22.23.4", pin: "22.23.4" });
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(
        join(root, ".github", "workflows", "ci.yml"),
        [
          "name: CI",
          "jobs:",
          "  quality:",
          "    steps:",
          "      - uses: actions/setup-node@v5",
          "        with:",
          `          node-version: "${alias}"`,
          "",
        ].join("\n"),
      );
      const result = checkNodeEnginePins(root);
      expect(result.ok, alias).toBe(false);
      expect(
        result.errors.some((error) => error.includes("not an exact x.y.z pin")),
        alias,
      ).toBe(true);
    }
  });

  it("fails when a required pin file is missing", () => {
    const root = fixtureRepo({ engines: ">=22.23.4", pin: "22.23.4" });
    unlinkSync(join(root, ".nvmrc"));
    const result = checkNodeEnginePins(root);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes(".nvmrc"))).toBe(true);
  });
});

function fixtureRepo(opts: { engines: string; pin: string }): string {
  const root = mkdtempSync(join(tmpdir(), "tsfulmen-node-pins-"));
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ engines: { node: opts.engines } }, null, 2)}\n`,
  );
  writeFileSync(join(root, ".nvmrc"), `${opts.pin}\n`);
  writeFileSync(join(root, ".node-version"), `${opts.pin}\n`);
  return root;
}
