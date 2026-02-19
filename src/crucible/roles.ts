import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { metrics } from "../telemetry/index.js";
import { listAssets } from "./discovery.js";
import { AssetNotFoundError } from "./errors.js";
import { assetIdToPath } from "./normalize.js";

// -- Types ------------------------------------------------------------------

export interface RolePrompt {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly status: string;
  readonly author?: string;
  readonly category?: string;
  readonly extends?: string;
  readonly domains?: readonly string[];
  readonly tags?: readonly string[];
  readonly context?: string;
  readonly scope: readonly string[];
  readonly mindset?: RoleMindset;
  readonly responsibilities: readonly string[];
  readonly escalates_to: readonly RoleEscalation[];
  readonly does_not: readonly string[];
  readonly examples?: readonly RoleExample[];
  readonly checklists?: Readonly<Record<string, readonly string[]>>;
  readonly pre_push_checklist?: readonly string[];
  readonly required_reading?: RoleRequiredReading;
  readonly cross_role_note?: string;
}

export interface RoleMindset {
  readonly focus: readonly string[];
  readonly principles: readonly string[];
}

export interface RoleEscalation {
  readonly target: string;
  readonly when: string;
}

export interface RoleExample {
  readonly type: string;
  readonly title?: string;
  readonly content: string;
}

export interface RoleRequiredReading {
  readonly description?: string;
  readonly pattern?: string;
  readonly files?: readonly RoleRequiredReadingFile[];
}

export interface RoleRequiredReadingFile {
  readonly path?: string;
  readonly reason?: string;
}

// -- Constants --------------------------------------------------------------

const ROLE_PREFIX = "agentic/roles";
const SLUG_PATTERN = /^[a-z][a-z0-9]*$/;

// -- Functions --------------------------------------------------------------

/**
 * List available role slugs, sorted alphabetically.
 * README and non-YAML assets are excluded.
 */
export async function listRoleSlugs(): Promise<readonly string[]> {
  const assets = await listAssets("config", { prefix: ROLE_PREFIX });

  const slugs: string[] = [];
  for (const asset of assets) {
    const filename = asset.id.slice(ROLE_PREFIX.length + 1);

    // Exclude README and any nested paths
    if (filename === "README" || filename.includes("/")) {
      continue;
    }

    if (SLUG_PATTERN.test(filename)) {
      slugs.push(filename);
    }
  }

  slugs.sort((a, b) => a.localeCompare(b));
  return slugs;
}

/**
 * Load a single role by slug.
 * @throws {AssetNotFoundError} if the slug does not match a role YAML
 */
export async function loadRole(slug: string): Promise<RolePrompt> {
  if (!SLUG_PATTERN.test(slug)) {
    const available = await listRoleSlugs();
    throw new AssetNotFoundError(slug, "config", [...available]);
  }

  const assetId = `${ROLE_PREFIX}/${slug}`;
  const path = assetIdToPath(assetId, "config");
  const fullPath = join(process.cwd(), path);

  try {
    const content = await readFile(fullPath, "utf-8");
    metrics.counter("foundry_lookup_count").inc();
    return parseYaml(content) as RolePrompt;
  } catch (_error) {
    const available = await listRoleSlugs();
    throw new AssetNotFoundError(slug, "config", [...available]);
  }
}

/**
 * Load all roles keyed by slug.
 */
export async function loadRoleCatalog(): Promise<ReadonlyMap<string, RolePrompt>> {
  const slugs = await listRoleSlugs();
  const catalog = new Map<string, RolePrompt>();

  for (const slug of slugs) {
    const role = await loadRole(slug);
    catalog.set(role.slug, role);
  }

  return catalog;
}
