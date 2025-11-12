/**
 * Simple test to verify foundry loader works with real data
 */

import { describe, expect, it } from "vitest";
import { loadPatternCatalog } from "../loader.js";

describe("Foundry Loader Integration", () => {
  it("should load real pattern catalog from SSOT", async () => {
    // This test uses the actual file system and YAML parsing
    const catalog = await loadPatternCatalog();

    expect(catalog).toBeDefined();
    expect(catalog.version).toBeDefined();
    expect(catalog.description).toBeDefined();
    expect(Array.isArray(catalog.patterns)).toBe(true);
    expect(catalog.patterns.length).toBeGreaterThan(0);

    // Verify first pattern structure
    const firstPattern = catalog.patterns[0];
    expect(firstPattern).toHaveProperty("id");
    expect(firstPattern).toHaveProperty("name");
    expect(firstPattern).toHaveProperty("kind");
    expect(firstPattern).toHaveProperty("pattern");

    console.log(`Loaded ${catalog.patterns.length} patterns from catalog`);
  });
});
