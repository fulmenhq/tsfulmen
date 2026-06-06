# Release Notes

This document tracks release notes and checklists for TSFulmen releases.

**Convention**: This file maintains the **last 3 released versions** in reverse chronological order (latest first) plus any unreleased work. Older releases are archived in `docs/releases/v{version}.md`. This provides sufficient recent context for release preparation while keeping the file manageable.

## [Unreleased]

_No unreleased changes._

---

## [0.3.0] - 2026-06-06

**Release Type**: Major Dependency Wave (breaking — Node engine floor)
**Status**: Ready for Release

### Summary

Coordinated major-dependency wave with **no public API changes** to tsfulmen's own exports. Migrates the four deferred majors from v0.2.10 — **archiver 8**, **pino 10**, **TypeScript 6** (dev), **commander 15** — and **raises the Node engine floor to `>=22.12.0`** (was `>=20.0.0`), which is the breaking change. Shipped as four reviewed PRs (#6, #9, #10, #11). Full details in `docs/releases/v0.3.0.md`.

### Highlights

- **Breaking — Node engine floor `>=22.12.0`**: required by commander 15 (ESM-only, `require(esm)`); also clears pino 10's Node-18 drop. No external consumers affected (the galaxy runs Node 22+).
- **Security — archiver 8**: removes the transitively-pulled, **unpatchable lodash 4.x advisories** (incl. `_.template` code injection, high). Net `bun audit` **23 → 17** findings. archiver 8 is a ground-up ESM rewrite (factory → classes); fulpack migrated with no public-API change, behind a local `archiver.d.ts` shim (DefinitelyTyped has no `@types/archiver@8` yet).
- **pino 10 / TypeScript 6 / commander 15**: clean bumps, no source changes (TS 6 needed only `ignoreDeprecations: "6.0"` for tsup's injected `baseUrl`).
- **Hardening**: fulpack content/permission round-trip tests + a `create()` error-path fix; logger severity-label coverage; Node 25 `fs.rm` teardown fix.

### Quality Gates

- Tests: 2131 passed | 16 skipped
- Lint: Clean (biome 2.4.16)
- TypeCheck: Clean (typescript 6.0.3)
- `make build` + `bun run validate:all`: Passing (fresh `.d.ts`)
- `make check-all`: Passing

### Follow-ups

- Remove the `archiver.d.ts` shim + restore `@types/archiver` once `@types/archiver@8` lands.
- Remove `ignoreDeprecations: "6.0"` once tsup stops injecting `baseUrl` (or before TS 7).
- Tracked: fulpack Tier 2 hardening (#7), Go↔Node fulpack parity corpus (#8), CLI arg-parse testability.

---

## [0.2.10] - 2026-06-05

**Release Type**: Security + Dependency + Infrastructure Maintenance
**Status**: Ready for Release

### Summary

Maintenance release — no public API changes. Clears a **CRITICAL** vitest advisory (GHSA-5xrq-8626-4rwp, UI-server arbitrary file read/exec) via vitest 4.1.8, syncs the Crucible SSOT to v0.4.13 (role catalog `devlead`/`devrev`/`qa` → v1.0.1 contract-parity), hardens CI, and lands a conservative minor/patch dependency wave. Shipped as four reviewed PRs. Full details in `docs/releases/v0.2.10.md`.

### Highlights

- **Security**: vitest 4.1.8 (CRITICAL); ajv 8.20.0, picomatch 4.0.4, yaml 2.9.0, fastify 5.8.5 direct-dep advisories cleared.
- **Crucible v0.4.13 sync**: contract-parity role catalog + goneat v0.5.12 formatting alignment in synced assets.
- **CI / process hardening**: normal commit/push/PR flow (guardian gate removed), single `GONEAT_VERSION` pin → v0.5.13, `download-artifact@v4.1.3`, `setup-bun@v2`, bun 1.3.9.
- **Deferred majors**: TypeScript 6, pino 10, commander 15, archiver 8.

---

## [0.2.8] - 2026-02-20

**Release Type**: Feature + Security + Dependency Maintenance
**Status**: Ready for Release

### Typed Role Catalog API

**Summary**: Adds programmatic, typed access to Crucible agentic role prompts via `@fulmenhq/tsfulmen/crucible`. Eliminates manual YAML parsing and ad-hoc type definitions that downstream repos (e.g., brooklyn-mcp) previously required.

#### New API

```typescript
import {
  listRoleSlugs,
  loadRole,
  loadRoleCatalog,
} from "@fulmenhq/tsfulmen/crucible";
import type { RolePrompt } from "@fulmenhq/tsfulmen/crucible";

const slugs = await listRoleSlugs();         // sorted, README excluded
const role = await loadRole("devlead");       // fully typed RolePrompt
const catalog = await loadRoleCatalog();      // Map<string, RolePrompt>
```

#### Types Exported

`RolePrompt`, `RoleMindset`, `RoleEscalation`, `RoleExample`, `RoleRequiredReading`, `RoleRequiredReadingFile`

#### Design Decisions

- Async (Promise) — matches configs.ts, docs.ts, schemas.ts patterns
- Throws `AssetNotFoundError` with fuzzy-match suggestions on invalid/missing slugs
- Slug validation: `^[a-z][a-z0-9]*$` (cross-team convention from Crucible v0.4.12)
- Readonly types throughout (matches existing `AssetSummary`, `ConfigSummary` conventions)
- 13 invariant-based tests (avoids brittleness when roles are added/removed)

### Security Fixes

| Advisory | Package | Severity | Fix |
|----------|---------|----------|-----|
| GHSA-jx2c | fastify <=5.7.2 | High | Bumped to ^5.7.4 |
| GHSA-mrq3 | fastify <=5.7.2 | Low | Same bump |
| GHSA-2g4f | ajv <8.18.0 | Moderate | Bumped to ^8.18.0 |

### Dependency Updates

| Package | From | To | Type |
|---------|------|----|------|
| ajv | ^8.17.1 | ^8.18.0 | Security fix |
| fastify | ^5.2.0 | ^5.7.4 | Security fix |
| @biomejs/biome | ^2.2.5 | ^2.4.3 | Tooling |
| typescript | ^5.7.2 | ^5.9.3 | Minor |
| @types/node | ^22.9.0 | ^25.3.0 | Major (types only) |
| @types/archiver | ^6.0.2 | ^7.0.0 | Major (types only) |
| @types/bun | ^1.1.12 | ^1.3.9 | Minor |
| @types/express | ^5.0.0 | ^5.0.6 | Patch |
| commander | ^14.0.1 | ^14.0.3 | Patch |
| yaml | ^2.6.1 | ^2.8.2 | Minor |
| prettier | ^3.6.2 | ^3.8.1 | Minor |
| tsup | ^8.3.5 | ^8.5.1 | Minor |
| tsx | ^4.19.2 | ^4.21.0 | Minor |

### Crucible SSOT

Updated to v0.4.12. 14 role YAMLs synced to `config/crucible-ts/agentic/roles/`.

### Documentation

Added comprehensive role catalog section to `docs/guides/crucible-assets.md` with quick start, type reference, error handling patterns, and migration guide.

### Quality Gates

- Tests: 2120 passed | 16 skipped
- Lint: Clean (biome 2.4.3)
- TypeCheck: Clean (typescript 5.9.3)
- `make check-all`: Passing

---

**Archive Policy**: This file maintains the **last 3 released versions** plus unreleased work. Older releases are archived in `docs/releases/v{version}.md` (see `docs/releases/v0.2.7.md`).
