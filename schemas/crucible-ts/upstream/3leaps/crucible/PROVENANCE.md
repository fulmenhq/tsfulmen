# Provenance: 3leaps/crucible

**DO NOT EDIT THESE FILES.** They are vendored copies from upstream.

## Source

| Field      | Value                                      |
| ---------- | ------------------------------------------ |
| Repository | https://github.com/3leaps/crucible         |
| Tag        | v0.1.4                                   |
| Commit     | 415cec1e5931d091252f91209f6e0456838c6a22 |
| Date       | 2026-01-22                               |
| Synced By  | devlead (Claude Opus 4.5 via Claude Code)  |

## Structure

```
schemas/upstream/3leaps/crucible/
├── schemas/
│   ├── agentic/v0/       # Role prompt schema (MANUAL)
│   ├── ailink/v0/        # Prompt/response schemas
│   ├── classifiers/v0/   # Dimension meta-schemas
│   └── foundation/v0/    # Type primitives, error response
├── config/
│   └── classifiers/      # Dimension definitions
├── docs/
│   ├── standards/        # Classification standards
│   └── catalog/          # Classifier catalog
└── PROVENANCE.md
```

## Files Synced

- **26 files** auto-synced via `3leaps-crucible-upstream-pull.ts`
- **1 file** manually synced: `schemas/agentic/v0/role-prompt.schema.json`

## Canonical URLs

These schemas are canonically hosted at:

- `https://schemas.3leaps.dev/classifiers/v0/*.json`
- `https://schemas.3leaps.dev/foundation/v0/*.json`
- `https://schemas.3leaps.dev/ailink/v0/*.json`

## Manual Sync Items

The following are NOT auto-synced - they require manual review for fulmenhq-specific customization:

- `schemas/agentic/v0/role-prompt.schema.json` - Present, manually synced
- `config/agentic/` - Not vendored (fulmenhq maintains its own role definitions)

## Refresh

To refresh from upstream:

```bash
bun run scripts/3leaps-crucible-upstream-pull.ts
```

Or with dry-run to preview:

```bash
bun run scripts/3leaps-crucible-upstream-pull.ts --dry-run
```
