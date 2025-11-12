import { describe, expect, it } from "vitest";
import { AssetNotFoundError, InvalidAssetIdError } from "../errors.js";

describe("AssetNotFoundError", () => {
  it("creates error with asset ID and category", () => {
    const error = new AssetNotFoundError("test.md", "docs", []);

    expect(error.name).toBe("AssetNotFoundError");
    expect(error.assetId).toBe("test.md");
    expect(error.category).toBe("docs");
    expect(error.message).toContain("Asset not found: docs/test.md");
  });

  it("includes suggestions when similar IDs exist", () => {
    const availableIds = [
      "standards/logging.md",
      "standards/logging-advanced.md",
      "guides/setup.md",
    ];

    const error = new AssetNotFoundError("standards/loging.md", "docs", availableIds);

    expect(error.suggestions.length).toBeGreaterThan(0);
    expect(error.suggestions).toContain("standards/logging.md");
    expect(error.message).toContain("Did you mean:");
    expect(error.message).toContain("standards/logging.md");
    expect(error.message).toMatch(/\d+% match/);
  });

  it("returns up to 3 suggestions", () => {
    const availableIds = [
      "standards/logging.md",
      "standards/logging-advanced.md",
      "standards/log.md",
      "standards/logs.md",
      "guides/logging.md",
    ];

    const error = new AssetNotFoundError("standards/loging.md", "docs", availableIds);

    expect(error.suggestions.length).toBeLessThanOrEqual(3);
  });

  it("has empty suggestions when no matches meet threshold", () => {
    const availableIds = ["architecture/decisions/ADR-0001.md"];

    const error = new AssetNotFoundError("completely-different.md", "docs", availableIds);

    expect(error.suggestions).toHaveLength(0);
    expect(error.message).not.toContain("Did you mean:");
  });

  it("normalizes suggestions with case-insensitive matching", () => {
    const availableIds = ["Standards/Logging.md", "GUIDES/SETUP.md"];

    const error = new AssetNotFoundError("standards/loging.md", "docs", availableIds);

    expect(error.suggestions.length).toBeGreaterThan(0);
  });

  it("works with schema IDs", () => {
    const availableIds = [
      "observability/logging/v1.0.0/logger-config",
      "observability/logging/v1.0.0/log-event",
      "library/foundry/v1.0.0/patterns",
    ];

    const error = new AssetNotFoundError(
      "observability/logging/v1.0.0/loger-config",
      "schemas",
      availableIds,
    );

    expect(error.message).toContain(
      "Asset not found: schemas/observability/logging/v1.0.0/loger-config",
    );
    expect(error.suggestions).toContain("observability/logging/v1.0.0/logger-config");
  });

  it("works with config IDs", () => {
    const availableIds = ["terminal/v1.0.0/terminal-overrides", "library/foundry/patterns"];

    const error = new AssetNotFoundError(
      "terminal/v1.0.0/terminal-override",
      "config",
      availableIds,
    );

    expect(error.category).toBe("config");
    expect(error.suggestions).toContain("terminal/v1.0.0/terminal-overrides");
  });

  it("has proper error stack", () => {
    const error = new AssetNotFoundError("test.md", "docs", []);
    expect(error.stack).toBeDefined();
  });
});

describe("InvalidAssetIdError", () => {
  it("creates error with asset ID, category, and reason", () => {
    const error = new InvalidAssetIdError("standards/logging", "docs", "Missing .md extension");

    expect(error.name).toBe("InvalidAssetIdError");
    expect(error.assetId).toBe("standards/logging");
    expect(error.category).toBe("docs");
    expect(error.message).toContain("Invalid asset ID for category 'docs': standards/logging");
    expect(error.message).toContain("Reason: Missing .md extension");
  });

  it("includes reason in message", () => {
    const error = new InvalidAssetIdError(
      "standards\\logging.md",
      "docs",
      "Backslashes not allowed",
    );

    expect(error.message).toContain("Backslashes not allowed");
  });

  it("works with different categories", () => {
    const errorDocs = new InvalidAssetIdError("test", "docs", "Missing extension");
    expect(errorDocs.category).toBe("docs");

    const errorSchemas = new InvalidAssetIdError("test.json", "schemas", "Extension not allowed");
    expect(errorSchemas.category).toBe("schemas");

    const errorConfig = new InvalidAssetIdError("test.yaml", "config", "Extension not allowed");
    expect(errorConfig.category).toBe("config");

    const errorTemplates = new InvalidAssetIdError("/test", "templates", "Leading slash");
    expect(errorTemplates.category).toBe("templates");
  });

  it("has proper error stack", () => {
    const error = new InvalidAssetIdError("test", "docs", "Invalid format");
    expect(error.stack).toBeDefined();
  });
});
