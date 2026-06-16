# Release Notes

This document tracks release notes and checklists for TSFulmen releases.

**Convention**: This file maintains the **last 3 released versions** in reverse chronological order (latest first) plus any unreleased work. Older releases are archived in `docs/releases/v{version}.md`. This provides sufficient recent context for release preparation while keeping the file manageable.

## [Unreleased]

_No unreleased changes._

---

## [0.3.1] - 2026-06-15

**Release Type**: Patch — compile-safety

<!-- The content of this entry mirrors the evergreen docs/releases/v0.3.1.md. -->

### Overview

v0.3.1 makes tsfulmen safe to embed in `bun build --compile` single-file binaries. v0.3.0 was clean, but downstream integration (`forge-workhorse-tuvan`) surfaced two `--compile` blockers in the published surface: tsfulmen's embedded CLIs self-executed on import and shadowed the consumer's own program, and an eager WASM load crashed compiled binaries at startup. Both are fixed and now guarded by a CI smoke test. There are no public API removals and the Node engine floor is unchanged (`>=22.12.0`).

### What Changed

#### Fixed

- **CLI shadowing under `bun build --compile`** — the schema, signals, and prometheus CLIs self-executed on import via the non-compile-safe guard `import.meta.url === \`file://${process.argv[1]}\``. Under `--compile`, every bundled module's `import.meta.url` and `process.argv[1]` collapse to the same `/$bunfs/root/<binary>` path, so the guard fired for non-entry modules — a compiled consumer importing `@fulmenhq/tsfulmen/schema` ran `tsfulmen-schema` instead of its own program. The library modules no longer parse argv on import; the executables now live in dedicated bin entries out of the importable library graph (#15).
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


**Archive Policy**: This file maintains the **last 3 released versions** plus unreleased work. Older releases are archived in `docs/releases/v{version}.md` (see `docs/releases/v0.2.7.md`).
