import { describe, expect, it } from "vitest";
import {
  getDocumentation,
  getDocumentationMetadata,
  getDocumentationWithMetadata,
  listDocumentation,
} from "../docs.js";
import { AssetNotFoundError } from "../errors.js";

describe("listDocumentation", () => {
  it("returns all documentation assets", async () => {
    const docs = await listDocumentation();

    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => d.category === "docs")).toBe(true);
    expect(docs.every((d) => d.id.endsWith(".md"))).toBe(true);
  });

  it("includes known documentation files", async () => {
    const docs = await listDocumentation();
    const ids = docs.map((d) => d.id);

    expect(ids.some((id) => id.includes("standards/"))).toBe(true);
  });

  it("filters by prefix", async () => {
    const docs = await listDocumentation({ prefix: "standards/" });

    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => d.id.startsWith("standards/"))).toBe(true);
  });

  it("respects limit option", async () => {
    const docs = await listDocumentation({ limit: 5 });

    expect(docs.length).toBeLessThanOrEqual(5);
  });

  it("filters by status", async () => {
    const docs = await listDocumentation({ status: "stable" });

    for (const doc of docs) {
      expect(doc.metadata?.status).toBe("stable");
    }
  });

  it("filters by tags", async () => {
    const docs = await listDocumentation({ tags: ["standards"] });

    for (const doc of docs) {
      expect(doc.metadata?.tags?.includes("standards")).toBe(true);
    }
  });

  it("returns sorted results", async () => {
    const docs = await listDocumentation();
    const ids = docs.map((d) => d.id);

    const sorted = [...ids].sort((a, b) => a.localeCompare(b));
    expect(ids).toEqual(sorted);
  });
});

describe("getDocumentation", () => {
  it("loads documentation content", async () => {
    const content = await getDocumentation("standards/README.md");

    expect(content).toBeDefined();
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(0);
  });

  it("includes frontmatter in raw content when present", async () => {
    const content = await getDocumentation("standards/agentic-attribution.md");

    expect(content).toContain("---");
  });

  it("throws AssetNotFoundError for missing document", async () => {
    await expect(getDocumentation("nonexistent/document.md")).rejects.toThrow(AssetNotFoundError);
  });

  it("includes suggestions in error", async () => {
    try {
      await getDocumentation("standards/READM.md");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AssetNotFoundError);
      const notFoundError = error as AssetNotFoundError;
      expect(notFoundError.suggestions.length).toBeGreaterThan(0);
      expect(notFoundError.suggestions).toContain("standards/README.md");
    }
  });
});

describe("getDocumentationWithMetadata", () => {
  it("extracts content and metadata", async () => {
    const result = await getDocumentationWithMetadata("standards/README.md");

    expect(result.content).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it("parses frontmatter metadata", async () => {
    const result = await getDocumentationWithMetadata("standards/README.md");

    if (result.metadata) {
      expect(result.metadata.title).toBeDefined();
    }
  });

  it("returns content without frontmatter delimiters", async () => {
    const result = await getDocumentationWithMetadata("standards/README.md");

    const lines = result.content.split("\n");
    expect(lines[0]).not.toBe("---");
  });

  it("handles documents without frontmatter", async () => {
    const result = await getDocumentationWithMetadata("architecture/decisions/template.md");

    expect(result.content).toBeDefined();
  });

  it("extracts standard metadata fields", async () => {
    const result = await getDocumentationWithMetadata("standards/agentic-attribution.md");

    if (result.metadata) {
      expect(result.metadata).toHaveProperty("title");
      expect(result.metadata).toHaveProperty("status");
    }
  });
});

describe("getDocumentationMetadata", () => {
  it("returns metadata without content", async () => {
    const metadata = await getDocumentationMetadata("standards/README.md");

    expect(metadata).toBeDefined();
  });

  it("returns null for missing document", async () => {
    const metadata = await getDocumentationMetadata("nonexistent.md");

    expect(metadata).toBeNull();
  });

  it("extracts title from metadata", async () => {
    const metadata = await getDocumentationMetadata("standards/README.md");

    if (metadata) {
      expect(metadata.title).toBeDefined();
      expect(typeof metadata.title).toBe("string");
    }
  });

  it("extracts status from metadata", async () => {
    const metadata = await getDocumentationMetadata("standards/agentic-attribution.md");

    if (metadata) {
      expect(metadata.status).toBeDefined();
    }
  });

  it("extracts tags from metadata", async () => {
    const metadata = await getDocumentationMetadata("standards/agentic-attribution.md");

    if (metadata?.tags) {
      expect(Array.isArray(metadata.tags)).toBe(true);
    }
  });
});
