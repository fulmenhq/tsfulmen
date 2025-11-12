import { describe, expect, it } from "vitest";

import { extractHeaders } from "../headers.ts";

const encoder = new TextEncoder();

describe("extractHeaders", () => {
  it("extracts ATX headers with slugs", () => {
    const input = "# Title\n## Sub Section\nParagraph\n### Deep\n";
    const headers = extractHeaders(input);

    expect(headers).toEqual([
      { level: 1, text: "Title", slug: "title", line: 1 },
      { level: 2, text: "Sub Section", slug: "sub-section", line: 2 },
      { level: 3, text: "Deep", slug: "deep", line: 4 },
    ]);
  });

  it("respects frontmatter when computing line numbers", () => {
    const input = "---\ntitle: Sample\n---\n\n# Intro\n";
    const headers = extractHeaders(input);

    expect(headers).toHaveLength(1);
    expect(headers[0]).toMatchObject({ line: 5, text: "Intro" });
  });

  it("captures setext headers", () => {
    const input = "Section Title\n===========\n\nSubsection\n-----------\n";
    const headers = extractHeaders(input);

    expect(headers).toEqual([
      { level: 1, text: "Section Title", slug: "section-title", line: 1 },
      { level: 2, text: "Subsection", slug: "subsection", line: 4 },
    ]);
  });

  it("ignores headers inside fenced code blocks and indented code", () => {
    const input = "```\n# not a heading\n```\n    # also not\n# Real Heading\n";
    const headers = extractHeaders(input);

    expect(headers).toEqual([{ level: 1, text: "Real Heading", slug: "real-heading", line: 5 }]);
  });

  it("supports custom slugify function", () => {
    const input = "# Héllo World!\n";
    const headers = extractHeaders(input, {
      slugify: (text) => text.replace(/\s+/g, "_"),
    });

    expect(headers[0].slug).toBe("Héllo_World!");
  });

  it("respects maxDepth option", () => {
    const input = "# One\n## Two\n### Three\n";
    const headers = extractHeaders(input, { maxDepth: 2 });

    expect(headers).toEqual([
      { level: 1, text: "One", slug: "one", line: 1 },
      { level: 2, text: "Two", slug: "two", line: 2 },
    ]);
  });

  it("accepts Uint8Array input", () => {
    const input = encoder.encode("# Binary Input\n");
    const headers = extractHeaders(input);

    expect(headers[0]).toMatchObject({ text: "Binary Input", line: 1 });
  });
});
