# Release Notes

This document tracks release notes and checklists for TSFulmen releases.

**Convention**: This file maintains the **last 3 released versions** in reverse chronological order (latest first) plus any unreleased work. Older releases are archived in `docs/releases/v{version}.md`. This provides sufficient recent context for release preparation while keeping the file manageable.

## [Unreleased]

_No unreleased changes._

---

## [0.4.0] - 2026-06-24

**Release Type**: Minor — compile-safe SSOT asset embedding

<!-- The content of this entry mirrors the evergreen docs/releases/v0.4.0.md. -->

### Overview

Makes every bundled SSOT asset (schemas, JSON-Schema metaschemas, foundry catalogs, telemetry taxonomy) resolve **without the filesystem**, so tsfulmen works fully inside a `bun build --compile` single-file binary — including standalone `serve`, schema discovery, and config validation. Driven by a central `AssetResolver` (filesystem + embedded backends) that all SSOT loads route through. Additive API; engine floor unchanged (`>=22.12.0`).

### Added

- **`@fulmenhq/tsfulmen/assets`** — `AssetResolver` layer (`FsAssetResolver` + `EmbeddedAssetResolver`; `resolveAssets`/`getAssetResolver`; `TSFULMEN_ASSET_MODE` = `auto`|`fs`|`embedded`).
- **Embedded SSOT asset modules** (`src/assets/generated/`, checked in; `make embed-assets` + drift-guarded `verify-embedded-assets`).
- **Compile-safety CI guards**: `verify-embedded-compile` (in-binary read/enumerate **and** standalone `serve`) and `verify-dist-asset-partition` (lean entries, one shared corpus chunk, size report).

### Changed

- All SSOT asset loads route through the `AssetResolver` (registry, validator incl. cross-tree `$ref`, foundry catalogs+signals, telemetry taxonomy); `SchemaMetadata.path` is now logical.
- `tsup splitting: true` — corpus deduped into one shared chunk (dist tree ~3.7 MB vs ~24 MB; ~1.1 MB of that is JS, rest is type declarations + maps); published `dist/` includes `chunk-*.js`.
- Synced Crucible SSOT `v0.4.14 → v0.4.15` ($ref/$id layout fixes).

### Fixed

- Standalone `serve`, schema discovery, and config validation work in `bun build --compile` binaries.

### Operator note

`serve` binds **`127.0.0.1` (loopback) by default**. Keep loopback unless you intentionally bind publicly (`--host 0.0.0.0`), in which case front it with auth / rate-limiting.

### Testing & Validation

- `make check-all` — **2194 tests passed** (16 skipped) + parities + embedded drift.
- Pre-tag gauntlet green: build (+partition/size guard), verify-artifacts, verify-local-install, verify-compile-smoke, verify-embedded-compile (read + in-binary serve).

### Follow-ups

- Downstream: `forge-workhorse-tuvan` (a downstream service that ships tsfulmen in a compiled single-file binary) can run standalone `serve` in compiled binaries and drop its `serve`-descope.

---

## [0.3.3] - 2026-06-17

**Release Type**: Patch — compile-safety ergonomics

<!-- The content of this entry mirrors the evergreen docs/releases/v0.3.3.md. -->

### Overview

Two purely-additive, patch-compatible API options for `bun --compile` consumers, ahead of the v0.4.0 embedding epic: `registerEmbeddedIdentity(data, { skipValidation })` (register a build-embedded, CI-validated identity without the FS-backed schema registry) and inline `defaults`/`schema` on `loadConfig` (new `LoadInlineConfigOptions` + overload). No breaking changes; engine floor unchanged (`>=22.12.0`). Superseded by v0.4.0 (full SSOT asset embedding).

---

## [0.3.2] - 2026-06-17

**Release Type**: Patch — app-identity follow-up

<!-- The content of this entry mirrors the evergreen docs/releases/v0.3.2.md. -->

### Overview

A small follow-up to v0.3.1's app-identity work. Crucible **v0.4.14** added a formal `metadata.typescript` section to the app-identity schema (the npm analogue of `metadata.python`); v0.3.2 syncs tsfulmen's bundled Crucible SSOT to v0.4.14 and promotes `.fulmen/app.yaml` from its interim custom `metadata.console_scripts` field to that first-class section. No code or behavior change; Node floor unchanged (`>=22.12.0`); the only published delta is the refreshed bundled `crucible-ts` schemas.

### Changed

- **Synced Crucible SSOT `v0.4.13 → v0.4.14`** (`.goneat/ssot-consumer.yaml`). `make sync-ssot` refreshed the bundled app-identity assets under `schemas/crucible-ts`, `config/crucible-ts`, `docs/crucible-ts`: the schema now carries the optional `metadata.typescript` object (`package_name` + `console_scripts: [{name, entry_point}]` → package.json `bin`), plus the `typescript-package` fixture and `typescript_package` parity case.
- **Promoted `.fulmen/app.yaml` to `metadata.typescript`** — the three bins (`tsfulmen-schema`, `tsfulmen-signals`, `tsfulmen-prometheus`) move from the interim custom `metadata.console_scripts` field to the formal `metadata.typescript` section. `.fulmen/app.yaml` is the repo's own identity and is not in the npm `files` payload.

### Testing & Validation

- `make validate-app-identity` — passes against the synced v0.4.14 schema.
- `make check-all` — **2131 tests passed** (16 skipped); app-identity + schema-export parity pass (incl. the new `typescript_package` case).
- `make verify-artifacts` / `verify-local-install` / `verify-compile-smoke` — green.

### Follow-ups

- Downstream: `forge-workhorse-tuvan` 0.1.7 bumps `@fulmenhq/tsfulmen` → 0.3.2 and rebuilds.

---

## [0.3.1] - 2026-06-15

**Release Type**: Patch — compile-safety

<!-- The content of this entry mirrors the evergreen docs/releases/v0.3.1.md. -->

### Overview

v0.3.1 makes tsfulmen safe to embed in `bun build --compile` single-file binaries. v0.3.0 was clean, but downstream integration (`forge-workhorse-tuvan`) surfaced two `--compile` blockers in the published surface: tsfulmen's embedded CLIs self-executed on import and shadowed the consumer's own program, and an eager WASM load crashed compiled binaries at startup. Both are fixed and now guarded by a CI smoke test. There are no public API removals and the Node engine floor is unchanged (`>=22.12.0`).

### What Changed

#### Fixed

- **CLI shadowing under `bun build --compile`** — the schema, signals, and prometheus CLIs self-executed on import via a non-compile-safe main-module guard comparing `import.meta.url` to `process.argv[1]`. Under `--compile`, every bundled module's `import.meta.url` and `process.argv[1]` collapse to the same `/$bunfs/root/<binary>` path, so the guard fired for non-entry modules — a compiled consumer importing `@fulmenhq/tsfulmen/schema` ran `tsfulmen-schema` instead of its own program. The library modules no longer parse argv on import; the executables now live in dedicated bin entries out of the importable library graph (#15).
- **Compiled-binary WASM `ENOENT` crash** — bumped `@3leaps/string-metrics-wasm` 0.3.8 → 0.3.10, which fixes the eager top-level `readFileSync(new URL(...))` WASM load that `--compile` rewrites but does not embed (compiled binaries crashed at startup with `ENOENT … string_metrics_wasm_bg.wasm`). Consumers no longer need an `overrides` entry to force the fix (#14).

#### Added

- **Package bin commands** — `tsfulmen-schema`, `tsfulmen-signals`, and `tsfulmen-prometheus` are now exposed as package `bin` entries (dedicated entrypoints, separate from the importable library surface). These developer CLIs were previously internal-only and not installable. This is additive — no existing API changes.
- **`.fulmen/app.yaml` app identity** — now that the package ships executables, it declares a Fulmen app identity (binary `tsfulmen`, vendor `fulmenhq`, category `sdk`), which also fixes the previously latent `make validate-app-identity` target. It is intentionally **not** shipped in the package (`files`): it is the repo's own identity and must not interfere with a consumer's identity discovery (#16).

#### Internal / CI

- **`createPrometheusCLI()` factory** — the prometheus CLI's `main()` was refactored into a pure exported factory (no parse on import), which also delivers the v0.3.0 CHANGELOG `buildProgram()` testability follow-up (#15).
- **Compiled-binary smoke guard** — a new CI step plus `make verify-compile-smoke` packs the tarball, installs it into an isolated consumer, `bun build --compile`s a fixture importing both the schema (shadow) and similarity (WASM) surfaces, and asserts the consumer owns its CLI and WASM loads. Both v0.3.0 blockers shipped silently because nothing exercised `--compile`; this owns that guard upstream (#17).
- **GitHub Actions off the Node 20 runtime** — bumped `checkout`/`cache`/`upload-artifact`/`download-artifact` to their node24 majors ahead of GitHub's 2026-06-16 cutover; normalized `setup-bun` and dropped an invalid `cache:` input (#13).

### Consumer Impact

**No breaking changes; no migration required.** tsfulmen's public API (`@fulmenhq/tsfulmen` and all subpaths) and the Node floor (`>=22.12.0`) are unchanged. Consumers embedding tsfulmen in `bun build --compile` binaries should upgrade to 0.3.1: their own CLI is no longer shadowed, and compiled binaries no longer crash on the string-metrics WASM load. The new `tsfulmen-*` bin commands are additive.

### Follow-ups

- **Crucible app-identity schema** — add a `metadata.node.console_scripts` section (mirroring `python`) so multi-bin TypeScript packages can enumerate their bins first-class; then promote tsfulmen's interim custom `metadata.console_scripts` field.
- Carryover from v0.3.0: remove the `src/fulpack/archiver.d.ts` shim once `@types/archiver@8` lands; remove `ignoreDeprecations: "6.0"` before the TS 7 upgrade; fulpack Tier 2 test hardening (#7) and the Go↔Node fulpack parity corpus (#8).

### Testing & Validation

- `make check-all` — typecheck, lint, **2131 tests passed** (16 skipped).
- `make verify-compile-smoke` — **4/4** (compile succeeds; compiled `--version`/`--help` are the consumer's, not `tsfulmen-schema`; WASM-backed `score()` runs with no `ENOENT`).
- `make build` + `bun run validate:all` — green (exports / tsup / source-modules / package / imports / types).
- CI green across all five PRs (#13, #14, #15, #16, #17).

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

**Archive Policy**: This file maintains the **last 3 released versions** plus unreleased work. Older releases are archived in `docs/releases/v{version}.md` (see `docs/releases/v0.2.7.md`).
