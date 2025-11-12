import { describe, expect, it } from "vitest";
import {
  assetIdToPath,
  extractConfigCategory,
  extractSchemaKind,
  extractVersion,
  normalizeSeparators,
  pathToAssetId,
  validateAssetId,
} from "../normalize.js";

describe("normalizeSeparators", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizeSeparators("foo\\bar\\baz")).toBe("foo/bar/baz");
  });

  it("preserves forward slashes", () => {
    expect(normalizeSeparators("foo/bar/baz")).toBe("foo/bar/baz");
  });

  it("handles mixed separators", () => {
    expect(normalizeSeparators("foo\\bar/baz\\qux")).toBe("foo/bar/baz/qux");
  });

  it("handles empty string", () => {
    expect(normalizeSeparators("")).toBe("");
  });
});

describe("pathToAssetId", () => {
  describe("docs category", () => {
    it("strips docs/crucible-ts/ prefix", () => {
      expect(pathToAssetId("docs/crucible-ts/standards/logging.md", "docs")).toBe(
        "standards/logging.md",
      );
    });

    it("keeps .md extension", () => {
      expect(pathToAssetId("docs/crucible-ts/README.md", "docs")).toBe("README.md");
    });

    it("normalizes Windows paths", () => {
      expect(pathToAssetId("docs\\crucible-ts\\standards\\logging.md", "docs")).toBe(
        "standards/logging.md",
      );
    });

    it("preserves nested paths", () => {
      expect(pathToAssetId("docs/crucible-ts/architecture/decisions/ADR-0001.md", "docs")).toBe(
        "architecture/decisions/ADR-0001.md",
      );
    });

    it("handles path without prefix", () => {
      expect(pathToAssetId("standards/logging.md", "docs")).toBe("standards/logging.md");
    });
  });

  describe("schemas category", () => {
    it("strips schemas/crucible-ts/ prefix", () => {
      expect(
        pathToAssetId(
          "schemas/crucible-ts/observability/logging/v1.0.0/logger-config.json",
          "schemas",
        ),
      ).toBe("observability/logging/v1.0.0/logger-config");
    });

    it("removes .json extension", () => {
      expect(
        pathToAssetId("schemas/crucible-ts/library/foundry/v1.0.0/patterns.json", "schemas"),
      ).toBe("library/foundry/v1.0.0/patterns");
    });

    it("removes .yaml extension", () => {
      expect(pathToAssetId("schemas/crucible-ts/config/test.yaml", "schemas")).toBe("config/test");
    });

    it("normalizes Windows paths", () => {
      expect(
        pathToAssetId(
          "schemas\\crucible-ts\\observability\\logging\\v1.0.0\\logger-config.json",
          "schemas",
        ),
      ).toBe("observability/logging/v1.0.0/logger-config");
    });

    it("handles path without prefix", () => {
      expect(pathToAssetId("observability/logging/v1.0.0/logger-config.json", "schemas")).toBe(
        "observability/logging/v1.0.0/logger-config",
      );
    });
  });

  describe("config category", () => {
    it("strips config/crucible-ts/ prefix", () => {
      expect(
        pathToAssetId("config/crucible-ts/terminal/v1.0.0/terminal-overrides.yaml", "config"),
      ).toBe("terminal/v1.0.0/terminal-overrides");
    });

    it("removes .yaml extension", () => {
      expect(pathToAssetId("config/crucible-ts/library/foundry/patterns.yaml", "config")).toBe(
        "library/foundry/patterns",
      );
    });

    it("removes .yml extension", () => {
      expect(pathToAssetId("config/crucible-ts/test/config.yml", "config")).toBe("test/config");
    });

    it("normalizes Windows paths", () => {
      expect(
        pathToAssetId("config\\crucible-ts\\terminal\\v1.0.0\\terminal-overrides.yaml", "config"),
      ).toBe("terminal/v1.0.0/terminal-overrides");
    });
  });

  describe("templates category", () => {
    it("strips templates/crucible-ts/ prefix", () => {
      expect(
        pathToAssetId("templates/crucible-ts/workflows/v2025.10.0/bootstrap", "templates"),
      ).toBe("workflows/v2025.10.0/bootstrap");
    });

    it("handles no extensions for templates", () => {
      expect(pathToAssetId("templates/crucible-ts/test/template", "templates")).toBe(
        "test/template",
      );
    });
  });
});

describe("assetIdToPath", () => {
  describe("docs category", () => {
    it("adds docs/crucible-ts/ prefix", () => {
      expect(assetIdToPath("standards/logging.md", "docs")).toBe(
        "docs/crucible-ts/standards/logging.md",
      );
    });

    it("preserves .md extension", () => {
      expect(assetIdToPath("README.md", "docs")).toBe("docs/crucible-ts/README.md");
    });
  });

  describe("schemas category", () => {
    it("adds schemas/crucible-ts/ prefix and .schema.json extension", () => {
      expect(assetIdToPath("observability/logging/v1.0.0/logger-config", "schemas")).toBe(
        "schemas/crucible-ts/observability/logging/v1.0.0/logger-config.schema.json",
      );
    });
  });

  describe("config category", () => {
    it("adds config/crucible-ts/ prefix and .yaml extension", () => {
      expect(assetIdToPath("terminal/v1.0.0/terminal-overrides", "config")).toBe(
        "config/crucible-ts/terminal/v1.0.0/terminal-overrides.yaml",
      );
    });
  });

  describe("templates category", () => {
    it("adds templates/crucible-ts/ prefix", () => {
      expect(assetIdToPath("workflows/v2025.10.0/bootstrap", "templates")).toBe(
        "templates/crucible-ts/workflows/v2025.10.0/bootstrap",
      );
    });
  });

  describe("round-trip conversion", () => {
    it("docs: path → id → path", () => {
      const original = "docs/crucible-ts/standards/logging.md";
      const id = pathToAssetId(original, "docs");
      const reconstructed = assetIdToPath(id, "docs");
      expect(reconstructed).toBe(original);
    });

    it("schemas: path → id → path", () => {
      const original = "schemas/crucible-ts/observability/logging/v1.0.0/logger-config.schema.json";
      const id = pathToAssetId(original, "schemas");
      const reconstructed = assetIdToPath(id, "schemas");
      expect(reconstructed).toBe(original);
    });

    it("config: path → id → path", () => {
      const original = "config/crucible-ts/terminal/v1.0.0/terminal-overrides.yaml";
      const id = pathToAssetId(original, "config");
      const reconstructed = assetIdToPath(id, "config");
      expect(reconstructed).toBe(original);
    });
  });
});

describe("validateAssetId", () => {
  describe("docs category", () => {
    it("accepts valid doc IDs with .md extension", () => {
      expect(validateAssetId("standards/logging.md", "docs")).toBe(true);
      expect(validateAssetId("README.md", "docs")).toBe(true);
      expect(validateAssetId("architecture/decisions/ADR-0001.md", "docs")).toBe(true);
    });

    it("rejects doc IDs without .md extension", () => {
      expect(validateAssetId("standards/logging", "docs")).toBe(false);
      expect(validateAssetId("README.txt", "docs")).toBe(false);
    });

    it("rejects IDs with backslashes", () => {
      expect(validateAssetId("standards\\logging.md", "docs")).toBe(false);
    });

    it("rejects IDs with leading slash", () => {
      expect(validateAssetId("/standards/logging.md", "docs")).toBe(false);
    });

    it("rejects IDs with trailing slash", () => {
      expect(validateAssetId("standards/logging.md/", "docs")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validateAssetId("", "docs")).toBe(false);
    });
  });

  describe("schemas category", () => {
    it("accepts valid schema IDs without extensions", () => {
      expect(validateAssetId("observability/logging/v1.0.0/logger-config", "schemas")).toBe(true);
      expect(validateAssetId("library/foundry/v1.0.0/patterns", "schemas")).toBe(true);
    });

    it("rejects schema IDs with .json extension", () => {
      expect(validateAssetId("observability/logging/v1.0.0/logger-config.json", "schemas")).toBe(
        false,
      );
    });

    it("rejects schema IDs with .yaml extension", () => {
      expect(validateAssetId("library/foundry/v1.0.0/patterns.yaml", "schemas")).toBe(false);
    });

    it("rejects IDs with backslashes", () => {
      expect(validateAssetId("observability\\logging\\v1.0.0\\logger-config", "schemas")).toBe(
        false,
      );
    });
  });

  describe("config category", () => {
    it("accepts valid config IDs without extensions", () => {
      expect(validateAssetId("terminal/v1.0.0/terminal-overrides", "config")).toBe(true);
      expect(validateAssetId("library/foundry/patterns", "config")).toBe(true);
    });

    it("rejects config IDs with .yaml extension", () => {
      expect(validateAssetId("terminal/v1.0.0/terminal-overrides.yaml", "config")).toBe(false);
    });

    it("rejects config IDs with .yml extension", () => {
      expect(validateAssetId("library/foundry/patterns.yml", "config")).toBe(false);
    });
  });

  describe("templates category", () => {
    it("accepts valid template IDs", () => {
      expect(validateAssetId("workflows/v2025.10.0/bootstrap", "templates")).toBe(true);
    });

    it("rejects IDs with backslashes", () => {
      expect(validateAssetId("workflows\\v2025.10.0\\bootstrap", "templates")).toBe(false);
    });
  });
});

describe("extractVersion", () => {
  it("extracts version from schema path", () => {
    expect(extractVersion("observability/logging/v1.0.0/logger-config")).toBe("1.0.0");
  });

  it("extracts version from config path", () => {
    expect(extractVersion("terminal/v1.0.0/terminal-overrides")).toBe("1.0.0");
  });

  it("extracts version with directory format", () => {
    expect(extractVersion("library/foundry/v2.3.4/patterns")).toBe("2.3.4");
  });

  it("returns null when no version present", () => {
    expect(extractVersion("standards/logging")).toBeNull();
    expect(extractVersion("README")).toBeNull();
  });

  it("returns null for malformed versions", () => {
    expect(extractVersion("library/v1/patterns")).toBeNull();
    expect(extractVersion("library/v1.0/patterns")).toBeNull();
  });
});

describe("extractSchemaKind", () => {
  it("extracts kind from schema path", () => {
    expect(extractSchemaKind("observability/logging/v1.0.0/logger-config")).toBe("observability");
    expect(extractSchemaKind("library/foundry/v1.0.0/patterns")).toBe("library");
    expect(extractSchemaKind("terminal/v1.0.0/schema")).toBe("terminal");
  });

  it("handles single-level paths", () => {
    expect(extractSchemaKind("test")).toBe("unknown");
  });

  it("returns unknown for empty string", () => {
    expect(extractSchemaKind("")).toBe("unknown");
  });
});

describe("extractConfigCategory", () => {
  it("extracts category from config path", () => {
    expect(extractConfigCategory("terminal/v1.0.0/terminal-overrides")).toBe("terminal");
    expect(extractConfigCategory("library/foundry/patterns")).toBe("library");
  });

  it("handles single-level paths", () => {
    expect(extractConfigCategory("test")).toBe("unknown");
  });

  it("returns unknown for empty string", () => {
    expect(extractConfigCategory("")).toBe("unknown");
  });
});
