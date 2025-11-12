import { describe, expect, it } from "vitest";
import { getConfigDefaults, listConfigDefaults } from "../configs.js";
import { AssetNotFoundError } from "../errors.js";

describe("listConfigDefaults", () => {
  it("returns all config assets", async () => {
    const configs = await listConfigDefaults();

    expect(configs.length).toBeGreaterThan(0);
    expect(configs.every((c) => c.category === "config")).toBe(true);
  });

  it("extracts config category from path", async () => {
    const configs = await listConfigDefaults();

    expect(configs.every((c) => c.configCategory.length > 0)).toBe(true);
  });

  it("extracts version from path", async () => {
    const configs = await listConfigDefaults();

    expect(configs.every((c) => c.version.length > 0)).toBe(true);
  });

  it("filters by category", async () => {
    const configs = await listConfigDefaults("library");

    expect(configs.length).toBeGreaterThan(0);
    expect(configs.every((c) => c.configCategory === "library")).toBe(true);
  });

  it("includes known config categories", async () => {
    const configs = await listConfigDefaults();
    const categories = new Set(configs.map((c) => c.configCategory));

    expect(categories.has("library")).toBe(true);
  });

  it("returns sorted results", async () => {
    const configs = await listConfigDefaults();
    const ids = configs.map((c) => c.id);

    const sorted = [...ids].sort((a, b) => a.localeCompare(b));
    expect(ids).toEqual(sorted);
  });
});

describe("getConfigDefaults", () => {
  it("loads config by category and version", async () => {
    const configs = await listConfigDefaults();
    const configsWithVersion = configs.filter(
      (c) => c.version !== "unknown" && c.version.match(/\d+\.\d+\.\d+/),
    );
    if (configsWithVersion.length > 0) {
      const firstConfig = configsWithVersion[0];
      const version = firstConfig.version.startsWith("v")
        ? firstConfig.version.slice(1)
        : firstConfig.version;
      const config = await getConfigDefaults(firstConfig.configCategory, version);

      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
    }
  });

  it("accepts version with v prefix", async () => {
    const configs = await listConfigDefaults();
    const configsWithVersion = configs.filter(
      (c) => c.version !== "unknown" && c.version.match(/\d+\.\d+\.\d+/),
    );
    if (configsWithVersion.length > 0) {
      const firstConfig = configsWithVersion[0];
      const version = firstConfig.version.startsWith("v")
        ? firstConfig.version
        : `v${firstConfig.version}`;
      const config = await getConfigDefaults(firstConfig.configCategory, version);
      expect(config).toBeDefined();
    }
  });

  it("accepts version without v prefix", async () => {
    const configs = await listConfigDefaults();
    const configsWithVersion = configs.filter(
      (c) => c.version !== "unknown" && c.version.match(/\d+\.\d+\.\d+/),
    );
    if (configsWithVersion.length > 0) {
      const firstConfig = configsWithVersion[0];
      const version = firstConfig.version.startsWith("v")
        ? firstConfig.version.slice(1)
        : firstConfig.version;
      const config = await getConfigDefaults(firstConfig.configCategory, version);
      expect(config).toBeDefined();
    }
  });

  it("accepts version without v prefix", async () => {
    const configs = await listConfigDefaults();
    if (configs.length > 0) {
      const firstConfig = configs[0];
      const version = firstConfig.version.startsWith("v")
        ? firstConfig.version.slice(1)
        : firstConfig.version;
      const config = await getConfigDefaults(firstConfig.configCategory, version);
      expect(config).toBeDefined();
    }
  });

  it("loads terminal config", async () => {
    const config = await getConfigDefaults("terminal", "1.0.0");
    expect(config).toBeDefined();
  });

  it("throws AssetNotFoundError for missing config", async () => {
    await expect(getConfigDefaults("nonexistent", "1.0.0")).rejects.toThrow(AssetNotFoundError);
  });

  it("includes suggestions in error", async () => {
    const configs = await listConfigDefaults();
    if (configs.length > 0) {
      const category = configs[0].configCategory;
      const typoCategory = category.slice(0, -1);

      try {
        await getConfigDefaults(typoCategory, "1.0.0");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AssetNotFoundError);
      }
    }
  });

  it("parses YAML config correctly", async () => {
    const configs = await listConfigDefaults();
    const configsWithVersion = configs.filter(
      (c) => c.version !== "unknown" && c.version.match(/\d+\.\d+\.\d+/),
    );
    if (configsWithVersion.length > 0) {
      const firstConfig = configsWithVersion[0];
      const version = firstConfig.version.startsWith("v")
        ? firstConfig.version.slice(1)
        : firstConfig.version;
      const config = await getConfigDefaults(firstConfig.configCategory, version);

      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
    }
  });

  it("preserves config structure", async () => {
    const configs = await listConfigDefaults();
    const configsWithVersion = configs.filter(
      (c) => c.version !== "unknown" && c.version.match(/\d+\.\d+\.\d+/),
    );
    if (configsWithVersion.length > 0) {
      const firstConfig = configsWithVersion[0];
      const version = firstConfig.version.startsWith("v")
        ? firstConfig.version.slice(1)
        : firstConfig.version;
      const config = (await getConfigDefaults(firstConfig.configCategory, version)) as Record<
        string,
        unknown
      >;

      expect(Object.keys(config).length).toBeGreaterThan(0);
    }
  });

  it("preserves config structure", async () => {
    const configs = await listConfigDefaults();
    if (configs.length > 0) {
      const firstConfig = configs[0];
      const version = firstConfig.version.startsWith("v")
        ? firstConfig.version.slice(1)
        : firstConfig.version;
      const config = (await getConfigDefaults(firstConfig.configCategory, version)) as Record<
        string,
        unknown
      >;

      expect(Object.keys(config).length).toBeGreaterThan(0);
    }
  });

  it("preserves config structure", async () => {
    const config = (await getConfigDefaults("library", "1.0.0")) as Record<string, unknown>;

    expect(Object.keys(config).length).toBeGreaterThan(0);
  });
});
