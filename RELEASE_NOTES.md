# Release Notes

This document tracks release notes and checklists for TSFulmen releases.

**Convention**: This file maintains the **last 3 released versions** in reverse chronological order (latest first) plus any unreleased work. Older releases are archived in `docs/releases/v{version}.md`. This provides sufficient recent context for release preparation while keeping the file manageable.

## [Unreleased]

_No unreleased changes._

---

## [0.2.1] - 2026-01-27

**Release Type**: Feature + Schema Infrastructure
**Status**: Ready for Release

### Schema Multi-Dialect Support, Fulencode Module & Beta Lifecycle

**Summary**: Extends schema validation to support all major JSON Schema drafts (draft-04 through draft-2020-12) with proper meta-validation, introduces the fulencode module as the canonical encoding/decoding facade, and graduates the project to `beta` lifecycle phase.

#### Lifecycle Phase: Alpha → Beta

Project graduates from `alpha` to `beta` per the [Repository Lifecycle Standard](docs/crucible-ts/standards/repository-lifecycle.md):

- **Test Coverage**: 71% line coverage (above 60% beta threshold)
- **Stability**: Feature-complete modules with stabilizing APIs
- **Documentation**: Kept current
- **Breaking Changes**: Addressed promptly with migration guidance

#### Schema: Multi-Dialect Validation

Schema meta-validation and compilation now supports:

- **draft-04** - Legacy schemas (via ajv-draft-04)
- **draft-06** - Intermediate draft
- **draft-07** - Widely adopted draft
- **draft-2019-09** - Modern draft with vocabularies
- **draft-2020-12** - Current draft (Fulmen default)

**Key improvements:**

- `validateSchema()` now validates against the declared `$schema` dialect, not just compilation success
- Dialect auto-detection from schema's `$schema` field
- Per-dialect AJV instances with appropriate metaschemas from Crucible v0.4.9
- Vocabulary schemas loaded for draft-2019-09 and draft-2020-12

```typescript
import { validateSchema } from "@fulmenhq/tsfulmen/schema";

// Validates against declared $schema dialect
const result = await validateSchema({
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: { name: { type: "string" } },
});
```

#### New Module: Fulencode

New `@fulmenhq/tsfulmen/fulencode` provides canonical encoding/decoding:

**Supported Formats:**

| Format       | Description                    |
| ------------ | ------------------------------ |
| `base64`     | Standard Base64 (RFC 4648)     |
| `base64url`  | URL-safe Base64 (RFC 4648 §5)  |
| `base64_raw` | Base64 without padding         |
| `hex`        | Hexadecimal                    |
| `base32`     | Standard Base32 (RFC 4648)     |
| `base32hex`  | Extended Hex Base32 (RFC 4648) |
| `utf-8`      | UTF-8 text encoding            |
| `utf-16le`   | UTF-16 Little Endian           |
| `utf-16be`   | UTF-16 Big Endian              |
| `iso-8859-1` | Latin-1 encoding               |
| `ascii`      | 7-bit ASCII                    |

**Usage:**

```typescript
import { fulencode } from "@fulmenhq/tsfulmen/fulencode";

// Encode binary to base64
const encoded = await fulencode.encode(
  new Uint8Array([72, 101, 108, 108, 111]),
  "base64",
);
console.log(encoded.data); // "SGVsbG8="

// Decode base64 to binary
const decoded = await fulencode.decode("SGVsbG8=", "base64");
console.log(new TextDecoder().decode(decoded.data)); // "Hello"

// With checksum computation
const result = await fulencode.encode(data, "hex", {
  computeChecksum: "sha256",
});
console.log(result.checksum); // "sha256:..."
```

**Features:**

- Padding control for base64/base32 formats
- Line wrapping with configurable length and endings
- Whitespace handling for decode operations
- Checksum computation via FulHash integration (sha256, xxh3-128)
- Structured error handling with `FulencodeError`

#### SSOT Updates: Crucible v0.4.9

- Bundled JSON Schema metaschemas for all supported drafts
- Vocabulary schemas for draft-2019-09 and draft-2020-12
- Meta catalog fixtures for dialect validation testing

#### Test Coverage Improvements

Overall line coverage improved from 63.4% to 71.16%:

| Module     | Before | After  | Improvement |
| ---------- | ------ | ------ | ----------- |
| fulencode  | 52.8%  | 99.6%  | +46.8%      |
| fulpack    | 41.7%  | 72.5%  | +30.8%      |
| schema     | 51.2%  | 70.1%  | +18.9%      |
| pathfinder | 77.4%  | 88.3%  | +10.9%      |

#### Quality Gates

- Tests: All passing
- Lint: Clean
- TypeCheck: Clean

---

## [0.2.0] - 2026-01-13

**Release Type**: Infrastructure + Governance + SSOT
**Status**: Ready for Release

### Role-Based Agent Model, Supply Chain Security & Crucible v0.4.8

**Summary**: Major infrastructure update adopting role-based AI agent identity model (replacing named identities), trust anchor bootstrap pattern, package cooling policy for supply chain security, and comprehensive Crucible SSOT update to v0.4.8.

#### Governance: Identity → Role Migration

Migrated from named agent identities (e.g., "Module Weaver") to functional roles per Crucible AI Agents Standard v2.0.0:

| Previous      | New Role   | Use Case                        |
| ------------- | ---------- | ------------------------------- |
| Module Weaver | `devlead`  | Implementation, features, fixes |
| -             | `devrev`   | Code review, four-eyes audit    |
| -             | `infoarch` | Documentation, schemas          |
| EA Steward    | `entarch`  | Ecosystem coordination          |
| -             | `secrev`   | Security review                 |
| -             | `cicd`     | CI/CD automation                |
| -             | `dataeng`  | Data engineering                |
| -             | `prodmktg` | Product marketing               |
| -             | `uxdev`    | UX development                  |

**Files Updated**:

- `AGENTS.md` - Complete rewrite for role-based operating model
- `MAINTAINERS.md` - Removed AI Co-Maintainers section, added role table
- `docs/development/adr/*.md` - Frontmatter updated to role slugs
- `docs/tsfulmen_overview.md` - Author changed to role
- `src/*/README.md` - Attribution updated

**Attribution Format**:

```
Generated by <Model> via <Interface> under supervision of @maintainer

Co-Authored-By: <Model> <noreply@3leaps.net>
Role: <role>
Committer-of-Record: <Name> <email> [@handle]
```

#### Infrastructure: Trust Anchor Bootstrap

New `scripts/make-bootstrap.sh` implementing the sfetch → goneat trust pyramid:

1. **sfetch** installed via published installer (trust anchor)
2. **sfetch self-verify** confirms cryptographic integrity
3. **goneat** installed via sfetch with minisign verification
4. **Foundation tools** installed via `goneat doctor tools --scope foundation`

Consistent with pyfulmen/rsfulmen bootstrap patterns.

#### Supply Chain Security

**Package Cooling Policy** (`.goneat/dependencies.yaml`):

- 7-day minimum age for new packages
- 100 minimum downloads threshold
- Exception for `@fulmenhq/*` organization packages
- Build fails on violations (not alert-only)

**License Compliance**:

- Forbidden: GPL, LGPL, AGPL, MPL, CDDL
- Allowed: MIT, Apache-2.0, BSD, ISC, Unlicense, CC0
- `make license-audit` generates inventory report

**Pre-push Hooks**: Now include `dependencies` category assessment.

#### SSOT Updates: Crucible v0.4.8

- **Role Catalog Expanded**: devlead, devrev, infoarch, entarch, secrev, cicd, dataeng, prodmktg, uxdev, qa
- **Signal Resolution Standard**: Cross-language fixtures for signal handling validation
- **TUI Design System Schemas**: `schemas/crucible-ts/design/` with color, typography, layout, component schemas
- **OpenAPI Spec Coverage Standard** (ADR-0014): Standardized API documentation coverage
- **Ecosystem Branding**: `config/crucible-ts/branding/ecosystem.yaml`
- **Similarity Module Promotion**: Relocated to `config/crucible-ts/library/similarity/`
- **Canonical URI Resolution**: Standard for spec publishing and cross-repo references

#### New Features

- **Signals Module Entry Point**: `@fulmenhq/tsfulmen/signals` for direct signal handling access
- **Embedded App Identity Fallback**: Resilient identity discovery when `.fulmen/app.yaml` not in ancestor path

#### Quality Gates

- Tests: All passing
- Lint: Clean
- TypeCheck: Clean
- License Audit: No forbidden licenses

---

## [0.1.14] - 2025-11-28

**Release Type**: Feature Update + SSOT Sync
**Status**: Released

### FulHash Extensions & CRC Support

**Summary**: Expanded the `fulhash` module with CRC32/CRC32C support, unified the hashing stack on `hash-wasm`, and added high-performance convenience helpers for multi-hashing and verification.

#### New Features: @fulmenhq/tsfulmen/fulhash

**Expanded Algorithms**:

- **CRC32**: Standard IEEE 802.3 polynomial (fast error detection)
- **CRC32C**: Castagnoli polynomial (optimized for iSCSI/SCTP)
- **Unified Stack**: All algorithms (XXH3, SHA, CRC) now powered by `hash-wasm` for consistent WASM performance and zero-dependency bloat.

**Convenience API**:

- **`multiHash(input, algorithms)`**: Compute multiple checksums (e.g., SHA256 + CRC32) in a single pass over the data.
- **`verify(input, checksum)`**: Validate data against a formatted checksum string (e.g., `crc32:cbf43926`).
- **Streaming Support**: Full streaming parity for all algorithms with async initialization.

**Performance**:

- XXH3-128: ~5 GB/s (streaming/block)
- SHA-256: ~2 GB/s
- CRC32/C: ~1.2 GB/s (via WASM)

#### SSOT Updates

- **Crucible v0.2.20**: Synced latest fulhash types and taxonomy.

#### Quality Gates

- **Tests**: 1786 tests passing (+30 new CRC/multihash tests)
- **Benchmarks**: New standalone benchmark suite in `scripts/perf/fulhash-crc-benchmark.ts`
- **Dependencies**: Removed `crc-32` and `fast-crc32c` (net -2 prod deps)

---

**Archive Policy**: This file maintains the **last 3 released versions** plus unreleased work. Older releases are archived in `docs/releases/v{version}.md`.
