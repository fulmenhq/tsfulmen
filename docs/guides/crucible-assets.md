---
title: "Consuming Crucible SSOT Assets via TSFulmen"
description: "How applications and templates should access Crucible docs/schemas/config through @fulmenhq/tsfulmen/crucible"
author: "EA Steward"
date: "2025-12-20"
status: "draft"
tags: ["crucible", "ssot", "guides", "templates", "runtime"]
---

# Consuming Crucible SSOT Assets via TSFulmen

This guide is for template and application repositories that depend on `@fulmenhq/tsfulmen` and need access to Crucible SSOT assets (docs, schemas, config defaults).

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
