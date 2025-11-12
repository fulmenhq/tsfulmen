import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { detectFormat, inspectDocument } from "../format.ts";

const FIXTURE_DIR = new URL("./fixtures/", import.meta.url);

function fixture(name: string): string {
  return readFileSync(new URL(name, FIXTURE_DIR), "utf-8");
}

describe("detectFormat", () => {
  it("detects json documents", () => {
    expect(detectFormat('{"key": 1}')).toBe("json");
  });

  it("detects yaml streams", () => {
    expect(detectFormat(fixture("multi-doc.yaml"))).toBe("yaml-stream");
  });

  it("detects markdown with frontmatter", () => {
    const input = "---\ntitle: Sample\n---\n# Heading";
    expect(detectFormat(input)).toBe("markdown");
  });

  it("detects plain yaml documents", () => {
    const input = "name: app\nversion: 1";
    expect(detectFormat(input)).toBe("yaml");
  });

  it("detects toml documents", () => {
    const input = '[service]\nname = "app"\nversion = "1"\nport = 8080';
    expect(detectFormat(input)).toBe("toml");
  });

  it("defaults to plain for text", () => {
    expect(detectFormat("Just some text.")).toBe("plain");
  });
});

describe("inspectDocument", () => {
  it("returns metadata and headers for markdown documents", () => {
    const input = "---\ntitle: Inspect Me\n---\n# Intro\nContent";
    const info = inspectDocument(input);

    expect(info.format).toBe("markdown");
    expect(info.hasFrontmatter).toBe(true);
    expect(info.metadata).toMatchObject({ title: "Inspect Me" });
    expect(info.headers).toHaveLength(1);
    expect(info.headerCount).toBe(1);
    expect(info.bodyStartLine).toBe(4);
    expect(info.estimatedSections).toBe(1);
  });

  it("handles json documents without frontmatter", () => {
    const info = inspectDocument('{"key": "value"}');

    expect(info.format).toBe("json");
    expect(info.hasFrontmatter).toBe(false);
    expect(info.metadata).toBeNull();
    expect(info.headerCount).toBe(0);
    expect(info.lineCount).toBe(1);
  });
});
