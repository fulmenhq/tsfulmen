import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { FixturesFile } from "../types.js";

const FIXTURES_PATH = join(process.cwd(), "config/crucible-ts/library/fulhash/fixtures.yaml");

describe("Fixture Loading", () => {
  it("should load fixtures YAML successfully", () => {
    expect(existsSync(FIXTURES_PATH)).toBe(true);

    const content = readFileSync(FIXTURES_PATH, "utf-8");
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(0);
  });

  it("should parse fixtures YAML into valid structure", () => {
    const content = readFileSync(FIXTURES_PATH, "utf-8");
    const fixtures: FixturesFile = parse(content);

    expect(fixtures).toBeDefined();
    expect(fixtures.version).toBe("1.0.0");
    expect(fixtures.description).toBeTruthy();
    expect(Array.isArray(fixtures.fixtures)).toBe(true);
    expect(fixtures.fixtures.length).toBeGreaterThan(0);
  });

  it("should validate fixture structure has required fields", () => {
    const content = readFileSync(FIXTURES_PATH, "utf-8");
    const fixtures: FixturesFile = parse(content);

    for (const fixture of fixtures.fixtures) {
      expect(fixture.name).toBeTruthy();
      expect(fixture.encoding).toBeTruthy();
      expect(fixture.xxh3_128).toBeTruthy();
      expect(fixture.sha256).toBeTruthy();

      expect(fixture.xxh3_128).toMatch(/^xxh3-128:[a-f0-9]+$/);
      expect(fixture.sha256).toMatch(/^sha256:[a-f0-9]+$/);

      if (fixture.input !== undefined) {
        expect(typeof fixture.input).toBe("string");
      }
      if (fixture.input_bytes !== undefined) {
        expect(Array.isArray(fixture.input_bytes)).toBe(true);
      }
    }
  });
});
