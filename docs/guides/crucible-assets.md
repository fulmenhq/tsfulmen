---
title: "Consuming Crucible SSOT Assets via TSFulmen"
description: "How applications and templates should access Crucible docs/schemas/config/roles through @fulmenhq/tsfulmen/crucible"
author: "EA Steward"
date: "2025-12-20"
lastUpdated: "2026-02-19"
status: "approved"
tags: ["crucible", "ssot", "guides", "templates", "runtime", "roles"]
---

# Consuming Crucible SSOT Assets via TSFulmen

This guide is for template and application repositories that depend on `@fulmenhq/tsfulmen` and need access to Crucible SSOT assets (docs, schemas, config defaults, and role prompts).

## Key Principle: assets live in your repo checkout

Today, TSFulmen’s Crucible shim reads from paths relative to `process.cwd()`:

- `docs/crucible-ts/`
- `schemas/crucible-ts/`
- `config/crucible-ts/`

That means your repository must sync (and typically commit) these assets.

> This matches the “dual-hosting” model described in `docs/crucible-ts/guides/consuming-crucible-assets.md` (synced from Crucible SSOT).

## Bootstrap + sync (recommended)

- Install tooling: `make bootstrap`
- Sync assets: `make sync-ssot`

In non-library repos, the equivalent is typically:

```bash
# Install goneat and configure ssot-consumer
# Then sync
goneat ssot sync
```

## Using the Crucible shim

```typescript
import {
  getCrucibleVersion,
  listAssets,
  listDocumentation,
  getDocumentationWithMetadata,
  listSchemas,
  loadSchemaById,
  listConfigDefaults,
  getConfigDefaults,
} from "@fulmenhq/tsfulmen/crucible";

// Version is sourced from the synced Crucible snapshot
console.log("Crucible version:", getCrucibleVersion());

// List all asset IDs in a category
const docs = await listAssets("docs", { prefix: "standards/" });

// Docs IDs INCLUDE the file extension (.md)
const doc = await getDocumentationWithMetadata(
  "standards/library/modules/app-identity.md",
);
console.log(doc.metadata?.title);

// Schema IDs DO NOT include extensions (TSFulmen appends the canonical .schema.json)
const schema = await loadSchemaById(
  "observability/logging/v1.0.0/logging-policy",
);

// Config defaults are parsed as YAML
const configs = await listConfigDefaults("library");
const defaults = await getConfigDefaults("library", "v1.0.0");

// Convenience helper for docs discovery + filtering
const approvedDocs = await listDocumentation({ status: "approved" });
```

## Role Catalog (v0.2.8+)

The role catalog API provides typed access to Crucible agentic role prompts. Before this API, consumers had to use `listAssets("config")` with prefix filtering, parse YAML manually, and define their own types — duplicating schema knowledge and risking drift.

### Quick start

```typescript
import {
  listRoleSlugs,
  loadRole,
  loadRoleCatalog,
} from "@fulmenhq/tsfulmen/crucible";

// List all available role slugs (sorted, README excluded)
const slugs = await listRoleSlugs();
// => ["cicd", "cxotech", "dataeng", "devlead", "devrev", "entarch", ...]

// Load a single role by slug
const role = await loadRole("devlead");
console.log(role.name);             // "Development Lead"
console.log(role.responsibilities); // ["Implement features...", ...]
console.log(role.escalates_to);     // [{ target: "human maintainers", when: "..." }, ...]

// Load the full catalog as a Map keyed by slug
const catalog = await loadRoleCatalog();
for (const [slug, role] of catalog) {
  console.log(`${slug}: ${role.description}`);
}
```

### Types

All types are exported from `@fulmenhq/tsfulmen/crucible`:

```typescript
import type {
  RolePrompt,              // Full role definition
  RoleMindset,             // { focus, principles }
  RoleEscalation,          // { target, when }
  RoleExample,             // { type, title?, content }
  RoleRequiredReading,     // { description?, pattern?, files? }
  RoleRequiredReadingFile,  // { path?, reason? }
} from "@fulmenhq/tsfulmen/crucible";
```

`RolePrompt` contains all fields from the canonical role schema:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `slug` | `string` | Yes | Unique identifier, matches `^[a-z][a-z0-9]*$` |
| `name` | `string` | Yes | Human-readable name |
| `description` | `string` | Yes | One-line summary |
| `version` | `string` | Yes | Semver |
| `status` | `string` | Yes | e.g. `"approved"` |
| `scope` | `string[]` | Yes | What this role covers |
| `responsibilities` | `string[]` | Yes | What this role does |
| `escalates_to` | `RoleEscalation[]` | Yes | When to hand off |
| `does_not` | `string[]` | Yes | Explicit exclusions |
| `author` | `string` | No | Who created the role |
| `category` | `string` | No | e.g. `"agentic"`, `"review"` |
| `extends` | `string` | No | URL of baseline role |
| `domains` | `string[]` | No | Domain tags |
| `tags` | `string[]` | No | Searchable tags |
| `context` | `string` | No | Usage guidance |
| `mindset` | `RoleMindset` | No | Focus questions and principles |
| `examples` | `RoleExample[]` | No | Commit/PR examples |
| `checklists` | `Record<string, string[]>` | No | Named checklists |
| `pre_push_checklist` | `string[]` | No | Pre-push steps |
| `required_reading` | `RoleRequiredReading` | No | Files to read before starting |
| `cross_role_note` | `string` | No | Guidance for role handoffs |

### Error handling

`loadRole()` throws `AssetNotFoundError` when a slug doesn't match any role YAML. The error includes fuzzy-match suggestions:

```typescript
import { AssetNotFoundError } from "@fulmenhq/tsfulmen/crucible";

try {
  await loadRole("devled"); // typo
} catch (err) {
  if (err instanceof AssetNotFoundError) {
    console.log(err.message);
    // "Asset not found: config/devled
    //
    //  Did you mean:
    //    - devlead (90% match)"
    console.log(err.suggestions); // ["devlead"]
  }
}
```

Invalid slugs (uppercase, hyphens, starting with digits) are also rejected:

```typescript
await loadRole("Dev-Lead");    // throws AssetNotFoundError
await loadRole("1startsdigit"); // throws AssetNotFoundError
```

### Common patterns

**Build an agent system prompt from a role:**

```typescript
const role = await loadRole("devlead");

const systemPrompt = [
  `# Role: ${role.name}`,
  "",
  role.context ?? role.description,
  "",
  "## Scope",
  ...role.scope.map((s) => `- ${s}`),
  "",
  "## Responsibilities",
  ...role.responsibilities.map((r) => `- ${r}`),
  "",
  "## Does Not",
  ...role.does_not.map((d) => `- ${d}`),
].join("\n");
```

**Check required reading before starting a task:**

```typescript
const role = await loadRole("releng");

if (role.required_reading?.files) {
  for (const file of role.required_reading.files) {
    console.log(`Must read: ${file.path} — ${file.reason}`);
  }
}
```

**Filter roles by category or domain:**

```typescript
const catalog = await loadRoleCatalog();

const reviewRoles = [...catalog.values()].filter(
  (r) => r.category === "review",
);

const devRoles = [...catalog.values()].filter(
  (r) => r.domains?.includes("development"),
);
```

### Migrating from manual YAML loading

If your repo was parsing role YAMLs directly (as brooklyn-mcp and other TypeScript repos did before this API), the migration is straightforward:

**Before (manual):**

```typescript
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { listAssets } from "@fulmenhq/tsfulmen/crucible";

// Find role assets by prefix
const assets = await listAssets("config", { prefix: "agentic/roles" });
const roleAssets = assets.filter((a) => !a.id.endsWith("README"));

// Load and parse each one
for (const asset of roleAssets) {
  const content = await readFile(asset.path, "utf-8");
  const role = parse(content) as any; // no type safety
  // ...
}
```

**After (typed API):**

```typescript
import { loadRoleCatalog } from "@fulmenhq/tsfulmen/crucible";
import type { RolePrompt } from "@fulmenhq/tsfulmen/crucible";

const catalog = await loadRoleCatalog();

for (const [slug, role] of catalog) {
  // role is fully typed as RolePrompt
  console.log(role.responsibilities);
}
```

### Prerequisites

Role YAMLs must be present in `config/crucible-ts/agentic/roles/` in your repository. If you've already run `make sync-ssot` (or `goneat ssot sync`), they're there. Verify with:

```bash
ls config/crucible-ts/agentic/roles/*.yaml
```

If the directory is empty or missing, sync first:

```bash
make sync-ssot
# or, in non-library repos:
goneat ssot sync
```

## Running outside the repo root

If your application’s runtime working directory is not the repo root (common for packaged binaries, Docker images, or process managers), resolve your repo root and `chdir` before calling the Crucible shim:

```typescript
import { findRepositoryRoot, GitMarkers } from "@fulmenhq/tsfulmen/pathfinder";

const repoRoot = await findRepositoryRoot(process.cwd(), GitMarkers);
process.chdir(repoRoot);
```

## Known limitation (and future direction)

Because the current shim uses `process.cwd()` internally, it is sensitive to runtime working directory.
A future improvement is to allow a configurable base directory (e.g., `createCrucible({ rootDir })`) so consumers can avoid `process.chdir()`.
