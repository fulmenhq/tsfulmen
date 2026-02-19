import { describe, expect, it } from "vitest";
import { AssetNotFoundError } from "../errors.js";
import { listRoleSlugs, loadRole, loadRoleCatalog } from "../roles.js";

describe("listRoleSlugs", () => {
  it("returns a non-empty sorted array", async () => {
    const slugs = await listRoleSlugs();

    expect(slugs.length).toBeGreaterThan(0);

    const sorted = [...slugs].sort((a, b) => a.localeCompare(b));
    expect(slugs).toEqual(sorted);
  });

  it("excludes README", async () => {
    const slugs = await listRoleSlugs();

    expect(slugs).not.toContain("README");
    expect(slugs).not.toContain("readme");
  });

  it("contains known core slugs", async () => {
    const slugs = await listRoleSlugs();
    const core = ["devlead", "devrev", "secrev", "entarch", "releng"];

    for (const slug of core) {
      expect(slugs).toContain(slug);
    }
  });

  it("all slugs match the schema pattern", async () => {
    const slugs = await listRoleSlugs();

    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z][a-z0-9]*$/);
    }
  });
});

describe("loadRole", () => {
  it("loads devlead with all required fields", async () => {
    const role = await loadRole("devlead");

    expect(role.slug).toBe("devlead");
    expect(role.name).toBeTruthy();
    expect(role.description).toBeTruthy();
    expect(role.version).toBeTruthy();
    expect(role.status).toBeTruthy();
    expect(role.scope.length).toBeGreaterThan(0);
    expect(role.responsibilities.length).toBeGreaterThan(0);
    expect(role.escalates_to.length).toBeGreaterThan(0);
    expect(role.does_not.length).toBeGreaterThan(0);
  });

  it("loads devlead with optional fields", async () => {
    const role = await loadRole("devlead");

    expect(role.author).toBeTruthy();
    expect(role.category).toBeTruthy();
    expect(role.domains).toBeDefined();
    expect(role.tags).toBeDefined();
    expect(role.context).toBeTruthy();
    expect(role.mindset).toBeDefined();
    expect(role.mindset?.focus.length).toBeGreaterThan(0);
    expect(role.mindset?.principles.length).toBeGreaterThan(0);
    expect(role.examples).toBeDefined();
    expect(role.examples?.length).toBeGreaterThan(0);
  });

  it("loads releng with required_reading.files, pre_push_checklist, cross_role_note", async () => {
    const role = await loadRole("releng");

    expect(role.slug).toBe("releng");
    expect(role.required_reading).toBeDefined();
    expect(role.required_reading?.files).toBeDefined();
    expect(role.required_reading?.files?.length).toBeGreaterThan(0);
    expect(role.required_reading?.files?.[0].path).toBeTruthy();
    expect(role.required_reading?.files?.[0].reason).toBeTruthy();
    expect(role.pre_push_checklist).toBeDefined();
    expect(role.pre_push_checklist?.length).toBeGreaterThan(0);
    expect(role.cross_role_note).toBeTruthy();
  });

  it("escalation entries have target and when", async () => {
    const role = await loadRole("devlead");

    for (const esc of role.escalates_to) {
      expect(esc.target).toBeTruthy();
      expect(esc.when).toBeTruthy();
    }
  });

  it("throws AssetNotFoundError for nonexistent slug", async () => {
    await expect(loadRole("nonexistent")).rejects.toThrow(AssetNotFoundError);
  });

  it("throws AssetNotFoundError for invalid slug format", async () => {
    await expect(loadRole("Invalid-Slug")).rejects.toThrow(AssetNotFoundError);
    await expect(loadRole("1startsdigit")).rejects.toThrow(AssetNotFoundError);
    await expect(loadRole("has-hyphen")).rejects.toThrow(AssetNotFoundError);
    await expect(loadRole("UPPER")).rejects.toThrow(AssetNotFoundError);
  });
});

describe("loadRoleCatalog", () => {
  it("returns a Map keyed by YAML slug field", async () => {
    const catalog = await loadRoleCatalog();

    expect(catalog.size).toBeGreaterThan(0);

    for (const [key, role] of catalog) {
      expect(key).toBe(role.slug);
    }
  });

  it("catalog size matches listRoleSlugs length", async () => {
    const slugs = await listRoleSlugs();
    const catalog = await loadRoleCatalog();

    expect(catalog.size).toBe(slugs.length);
  });

  it("catalog contains all listed slugs", async () => {
    const slugs = await listRoleSlugs();
    const catalog = await loadRoleCatalog();

    for (const slug of slugs) {
      expect(catalog.has(slug)).toBe(true);
    }
  });
});
