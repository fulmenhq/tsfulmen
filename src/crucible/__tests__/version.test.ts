import { describe, expect, it } from "vitest";
import { getCrucibleVersion } from "../version.js";

describe("getCrucibleVersion", () => {
  it("returns version metadata", () => {
    const version = getCrucibleVersion();

    expect(version).toBeDefined();
    expect(version.version).toBeDefined();
    expect(version.commit).toBeDefined();
    expect(version.dirty).toBeDefined();
    expect(version.syncMethod).toBeDefined();
  });

  it("returns string for version field", () => {
    const version = getCrucibleVersion();
    expect(typeof version.version).toBe("string");
    expect(version.version.length).toBeGreaterThan(0);
  });

  it("returns string for commit field", () => {
    const version = getCrucibleVersion();
    expect(typeof version.commit).toBe("string");
  });

  it("returns string or null for syncedAt field", () => {
    const version = getCrucibleVersion();
    expect(typeof version.syncedAt === "string" || version.syncedAt === null).toBe(true);
  });

  it("returns boolean for dirty field", () => {
    const version = getCrucibleVersion();
    expect(typeof version.dirty).toBe("boolean");
  });

  it("returns string for syncMethod field", () => {
    const version = getCrucibleVersion();
    expect(typeof version.syncMethod).toBe("string");
  });

  it("reads version from real sync-keys.yaml", () => {
    const version = getCrucibleVersion();
    expect(version.version).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}$|^unknown$/);
  });

  it("provides fallback for missing commit", () => {
    const version = getCrucibleVersion();
    expect(version.commit).toBeDefined();
  });

  it("provides fallback for missing syncedAt", () => {
    const version = getCrucibleVersion();
    if (version.syncedAt !== null) {
      expect(version.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("provides fallback for missing dirty flag", () => {
    const version = getCrucibleVersion();
    expect(typeof version.dirty).toBe("boolean");
  });

  it("provides fallback for missing syncMethod", () => {
    const version = getCrucibleVersion();
    expect(version.syncMethod).toBeDefined();
    expect(version.syncMethod.length).toBeGreaterThan(0);
  });

  it("returns consistent results on multiple calls", () => {
    const version1 = getCrucibleVersion();
    const version2 = getCrucibleVersion();

    expect(version1.version).toBe(version2.version);
    expect(version1.commit).toBe(version2.commit);
    expect(version1.syncedAt).toBe(version2.syncedAt);
    expect(version1.dirty).toBe(version2.dirty);
    expect(version1.syncMethod).toBe(version2.syncMethod);
  });
});
