---
title: "Foundry Module Standards"
description: "Standards for common reference data, patterns, and text utilities in Fulmen helper libraries"
author: "Schema Cartographer"
date: "2025-10-09"
last_updated: "2025-10-22"
status: "stable"
tags: ["standards", "library", "foundry", "patterns", "similarity", "2025.10.2"]
---

# Foundry Module Standards

## Overview

The Foundry module provides common reference data, reusable patterns, and text utilities that every Fulmen helper library must expose idiomatically. This reduces duplication, ensures consistency, and provides battle-tested implementations for common tasks like pattern matching, text comparison, and normalization.

## Capabilities

| Capability         | Description                                           | Standard Document                |
| ------------------ | ----------------------------------------------------- | -------------------------------- |
| Patterns           | Regex, glob, and literal pattern catalogs             | This document (Pattern Catalog)  |
| HTTP Status Groups | HTTP status code reference and grouping               | This document (HTTP Statuses)    |
| Country Codes      | ISO 3166-1 country code lookup (alpha-2/3, numeric)   | This document (Country Codes)    |
| MIME Types         | MIME type reference with extension mapping            | This document (MIME Types)       |
| Text Similarity    | Levenshtein distance, similarity scoring, suggestions | [similarity.md](./similarity.md) |
| Text Normalization | Unicode case folding, accent stripping, whitespace    | [similarity.md](./similarity.md) |

## Pattern Catalog

Shared catalog of reusable patterns (regex, glob, literal) that reduce duplication of complex expressions (e.g., email validation, slugs, IP addresses) across languages.

## Data Sources

- Pattern catalog: `config/library/foundry/patterns.yaml` (schema: `schemas/library/foundry/v1.0.0/patterns.schema.json`)
- HTTP status groups: `config/library/foundry/http-statuses.yaml` (schema: `schemas/library/foundry/v1.0.0/http-status-groups.schema.json`)
- ISO country codes (sample seed): `config/library/foundry/country-codes.yaml` (schema: `schemas/library/foundry/v1.0.0/country-codes.schema.json`)
- MIME types: `config/library/foundry/mime-types.yaml` (schema: `schemas/library/foundry/v1.0.0/mime-types.schema.json`)

Helper libraries MUST treat these catalogs as read-only SSOT data. Updates originate in Crucible.

## Library Responsibilities

1. Load the catalog at bootstrap and expose accessor APIs:
   - Return raw pattern strings.
   - Provide compiled/typed representations (e.g., `regex.Pattern`, `RegExp`, precompiled Go regex).
2. Enforce immutability and avoid runtime mutation of the shared catalog.
3. Surface documentation (e.g., `describe(patternId)`) pulling from the catalog’s metadata.
4. Integrate patterns into validation tooling where applicable (Pydantic validators, Go custom types, Zod schemas).
5. Normalize ISO country tokens (upper-case alpha codes, three-digit numeric strings) before indexing and maintain secondary indexes for alpha-3 and numeric codes so lookups stay case-insensitive across all ISO forms.

## Language Notes

- **Python:** Provide a `FoundryPatterns` helper that returns compiled `regex` instances and raw strings.
- **Go:** Expose typed wrappers returning `*regexp.Regexp` with lazy compilation.
- **TypeScript:** Export both the raw string and a `RegExp` instance per pattern (respecting flags).
- **Rust/C#:** Provide modules/namespaces with constants and precompiled helpers.

## Testing Requirements

- Validate catalog loading and ensure all entries are present (patterns, status groups, countries).
- Ensure accessors return compiled/typed representations without error.
- Provide positive/negative unit tests for each pattern (sample matches + mismatches).
- Verify HTTP status group helpers cover the documented codes; ensure language implementations expose convenience sets (e.g., `IsClientError(code)`).
- Verify country code lookups support alpha-2, alpha-3, and numeric forms case-insensitively (including numeric normalization) and reuse the precomputed indexes built at load time.
- Verify MIME type helpers handle lookup by id, MIME string, and extensions; add tests for unknown types.
- Maintain snapshot/parity tests to detect catalog drift across languages.
- Verify per-language flag handling (Unicode, ignore-case, etc.) in unit tests.

## Standards

### Patterns, HTTP Statuses, Country Codes, MIME Types

See sections above for pattern catalog, HTTP status groups, country code lookup, and MIME type reference standards.

### Text Similarity & Normalization

See [similarity.md](./similarity.md) for comprehensive standard covering:

- Levenshtein distance and similarity scoring
- Suggestion API for fuzzy matching
- Unicode-aware normalization (case folding, accent stripping)
- Shared fixtures for cross-language validation

## Related Documents

- [Text Similarity & Normalization Standard](./similarity.md)
- [Foundry Interfaces](./interfaces.md)
- `docs/architecture/modules/README.md`
- `config/library/v1.0.0/module-manifest.yaml`
- `config/library/foundry/patterns.yaml`
- `config/library/foundry/http-statuses.yaml`
- `config/library/foundry/country-codes.yaml`
- `config/library/foundry/similarity-fixtures.yaml`
- `.plans/active/2025.10.2/library-module-specification-architecture-v2.md`
