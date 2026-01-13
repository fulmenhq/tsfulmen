---
id: "ADR-0001"
title: "Split Linting: Biome for TS/JS, Goneat for Config/Docs"
status: "accepted"
scope: "tsfulmen"
date: "2025-10-15"
authors: ["devlead"]
reviewers: ["@3leapsdave"]
related_adrs: []
---

# ADR-0001: Split Linting: Biome for TS/JS, Goneat for Config/Docs

## Context

TSFulmen requires consistent code quality checks across multiple file types:

- **TypeScript/JavaScript** source code (`src/` directory)
- **Configuration files** (JSON, YAML) including `.goneat/`, `config/`, `schemas/`
- **Documentation** (Markdown) including README, ADRs, and synced Crucible docs

### Initial Approach (v0.1.0-alpha)

Early versions used:

- **Biome** for all file types (TS, JS, JSON, YAML, Markdown)
- **Prettier** as fallback for Markdown formatting

**Problems**:

1. Biome's JSON/YAML formatting doesn't match FulmenHQ ecosystem standards
2. Biome's Markdown support is limited compared to ecosystem tooling
3. Inconsistent formatting with sibling libraries (gofulmen, pyfulmen)
4. Prettier doesn't validate against schemas or goneat standards

### FulmenHQ Ecosystem Pattern

Both `gofulmen` and `pyfulmen` use:

- **Language-specific linter** for source code (golangci-lint, ruff)
- **Goneat** for configuration and documentation (`goneat format`, `goneat assess`)

**Rationale**: Goneat provides ecosystem-wide consistency for:

- Schema-aware JSON validation
- FulmenHQ-standard YAML formatting
- Markdown frontmatter validation
- Cross-repository consistency

## Decision

**Implement split linting/formatting in TSFulmen Makefile:**

### Linting (`make lint`)

```makefile
lint: tools
	@echo "Linting TypeScript/JavaScript..."
	@bunx biome check --no-errors-on-unmatched src/
	@echo "Assessing YAML/JSON/Markdown..."
	@goneat assess --categories format,lint --check
	@echo "✅ All linting passed"
```

### Formatting (`make fmt`)

```makefile
fmt: tools
	@echo "Formatting TypeScript/JavaScript..."
	@bunx biome check --write src/
	@echo "Formatting YAML/JSON/Markdown..."
	@goneat format --types yaml,json,markdown
	@echo "✅ All files formatted"
```

### Tool Responsibilities

| Tool       | File Types                      | Operations      | Scope                      |
| ---------- | ------------------------------- | --------------- | -------------------------- |
| **Biome**  | `.ts`, `.js`, `.tsx`, `.jsx`    | Lint + Format   | `src/` directory only      |
| **Goneat** | `.json`, `.yaml`, `.yml`, `.md` | Assess + Format | All directories            |
| **tsc**    | `.ts`, `.tsx`                   | Type checking   | `src/` via `tsconfig.json` |

### Excluded from Biome

Update `biome.json` to explicitly exclude non-TS/JS files:

```json
{
  "files": {
    "include": ["src/**/*.ts", "src/**/*.js"],
    "ignore": [
      "**/*.json",
      "**/*.yaml",
      "**/*.yml",
      "**/*.md",
      "node_modules",
      "dist"
    ]
  }
}
```

## Consequences

### Positive

✅ **Ecosystem Consistency**: Matches gofulmen/pyfulmen patterns exactly
✅ **Schema Validation**: Goneat validates JSON against schemas in `schemas/crucible-ts/`
✅ **Frontmatter Validation**: Goneat validates ADR frontmatter and YAML headers
✅ **Single Source of Truth**: Goneat uses canonical FulmenHQ formatting rules
✅ **Reduced Dependencies**: Remove Prettier dependency entirely
✅ **Clear Separation**: Each tool optimized for its file types

### Negative

⚠️ **Two Tools Required**: Developers must bootstrap both Biome (via bun) and Goneat
⚠️ **Learning Curve**: Contributors need to understand split responsibilities
⚠️ **Bootstrap Dependency**: Goneat must be installed before `make lint` or `make fmt` work

### Neutral

ℹ️ **Tool Count**: Same as pyfulmen (2 tools: ruff + goneat) and gofulmen (2 tools: golangci-lint + goneat)
ℹ️ **Performance**: Goneat processes 177 files in ~7 seconds (acceptable for CI/local dev)

## Implementation Details

### Biome Configuration

File: `biome.json`

```json
{
  "files": {
    "include": ["src/**/*.ts", "src/**/*.js"],
    "ignore": [
      "**/*.json",
      "**/*.yaml",
      "**/*.yml",
      "**/*.md",
      "node_modules",
      "dist",
      "coverage",
      "bin"
    ]
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab"
  }
}
```

### Goneat Integration

Goneat discovers files using:

- `.goneatignore` (if present)
- `.gitignore` fallback
- Explicit `--include` / `--exclude` flags (not used in our targets)

**Assessment Categories**:

- `format`: Checks formatting consistency
- `lint`: Validates against language-specific rules
- `schema`: Validates JSON against schemas (auto-enabled for `schemas/` dir)

**Command**: `goneat assess --categories format,lint --check`

### Type Checking

Separate from linting, type checking uses native TypeScript compiler:

```makefile
typecheck:
	@echo "Type checking with tsc..."
	@bunx tsc --noEmit
	@echo "✅ Type checking passed"
```

**Rationale**:

- Biome's type checking is incomplete compared to tsc
- tsc is canonical TypeScript type checker
- Matches ecosystem practice (pyfulmen uses mypy, gofulmen uses native Go compiler)

## Alternatives Considered

### Alternative 1: Biome for Everything

**Rejected Reasons**:

- Biome JSON/YAML formatting inconsistent with ecosystem
- No schema validation support
- No frontmatter validation for ADRs
- Creates divergence from gofulmen/pyfulmen patterns

### Alternative 2: Goneat for Everything (including TS)

**Rejected Reasons**:

- Goneat doesn't support TypeScript linting
- Biome is TypeScript-optimized and fast
- Would require adding TypeScript support to Goneat (unnecessary duplication)

### Alternative 3: ESLint + Prettier + Goneat

**Rejected Reasons**:

- ESLint + Prettier slower than Biome
- More dependencies to manage
- Biome provides unified experience for TS/JS
- Still requires Goneat for schema validation

## Verification

### Test Commands

```bash
# Format all files
make fmt

# Lint all files
make lint

# Full quality check
make check-all  # Runs: lint, typecheck, test
```

### Expected Output

**Biome** (TS/JS):

```
Linting TypeScript/JavaScript...
Checked 7 files in 2ms. No fixes applied.
```

**Goneat** (Config/Docs):

```
Assessing YAML/JSON/Markdown...
[INFO] goneat: Processing 177 files...
[INFO] goneat: Progress: 177/177 files (100.0%) - 177 formatted, 0 unchanged, 0 errors
```

## Related Standards

- [Makefile Standard](../../crucible-ts/standards/makefile-standard.md) - Defines `make lint` and `make fmt` requirements
- [TypeScript Coding Standard](../../crucible-ts/standards/coding/typescript.md) - TypeScript style guide
- [Frontmatter Standard](../../crucible-ts/standards/frontmatter-standard.md) - YAML frontmatter for ADRs and docs

## Rollout Plan

### v0.1.0 (Initial Commit)

- ✅ Update Makefile with split targets
- ✅ Update `biome.json` to exclude non-TS/JS files
- ✅ Document in this ADR
- ✅ Update CHANGELOG.md

### Post-v0.1.0

- [ ] Create Biome configuration guide in `docs/development/`
- [ ] Add troubleshooting section for common goneat issues
- [ ] Consider adding `.goneatignore` if needed for performance

## References

- **pyfulmen Makefile**: Uses `ruff` for Python, `goneat format` for config/docs
- **gofulmen Makefile**: Uses `golangci-lint` for Go, `goneat format` for config/docs
- **Biome Documentation**: https://biomejs.dev/
- **Goneat Repository**: https://github.com/fulmenhq/goneat

---

**Status**: Accepted and implemented in v0.1.0
**Last Updated**: 2025-10-15
**Next Review**: After v0.2.0 release feedback
