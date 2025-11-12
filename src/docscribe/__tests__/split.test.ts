import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { splitDocuments } from "../split.ts";

const FIXTURE_DIR = new URL("./fixtures/", import.meta.url);

function fixture(name: string): string {
  return readFileSync(new URL(name, FIXTURE_DIR), "utf-8");
}

describe("splitDocuments", () => {
  it("splits yaml streams into individual documents", () => {
    const docs = splitDocuments(fixture("multi-doc.yaml"));

    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({
      format: "yaml",
      startLine: 1,
      endLine: 3,
      index: 0,
    });
    expect(docs[1]).toMatchObject({ format: "yaml", startLine: 5, index: 1 });
  });

  it("splits multi-markdown documents while preserving code fences", () => {
    const docs = splitDocuments(fixture("multi-doc.md"));

    expect(docs).toHaveLength(2);
    expect(docs[0].metadata).toMatchObject({ title: "Doc One" });
    expect(docs[1].content).toContain("# Second Doc");
    expect(docs[1].content).toContain("```yaml");
  });

  it("respects maxDocuments option", () => {
    const docs = splitDocuments(fixture("multi-doc.yaml"), { maxDocuments: 1 });

    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("Deployment");
    expect(docs[0].content).toContain("Service");
  });

  it("returns single split for plain text", () => {
    const docs = splitDocuments("Plain text");

    expect(docs).toHaveLength(1);
    expect(docs[0].format).toBe("plain");
  });
});
