# TSFulmen Architecture Decision Records

This directory contains **local** (TypeScript-specific) ADRs for TSFulmen.

## Naming Convention

All ADRs use consistent `ADR-XXXX-kebab-case-title.md` format:

- **Ecosystem ADRs**: `docs/crucible-ts/architecture/decisions/ADR-XXXX-*.md` (synced from Crucible, read-only)
- **Local ADRs**: `docs/development/adr/ADR-XXXX-*.md` (this directory, library-maintained)

Location determines scope, not filename format.

## Cross-Referencing Ecosystem ADRs

When a local ADR relates to an ecosystem ADR, use the TypeScript-specific path:

```markdown
## Related Ecosystem ADRs

- [ADR-0001: Example Title](../../crucible-ts/architecture/decisions/ADR-0001-example-title.md)

This implements the ecosystem strategy using TypeScript-specific patterns.
```

## Local ADR Index

| ID                                                             | Title                                                  | Status   | Date       | Related Ecosystem ADRs |
| -------------------------------------------------------------- | ------------------------------------------------------ | -------- | ---------- | ---------------------- |
| [ADR-0001](ADR-0001-split-linting-biome-goneat.md)             | Split Linting: Biome for TS/JS, Goneat for Config/Docs | accepted | 2025-10-15 | N/A                    |
| [ADR-0002](ADR-0002-load-json-schema-2020-12-from-crucible.md) | Load JSON Schema 2020-12 Metaschema from Crucible SSOT | accepted | 2025-10-20 | N/A                    |

**Note**: Local ADRs are added as architectural decisions are made during module implementation.

## When to Write Local ADR

Write a local ADR when making decisions about:

- ✅ **TypeScript/Node.js/Bun-specific implementations**
  - Type system patterns (branded types, discriminated unions, mapped types)
  - Runtime behavior differences (V8 vs. JavaScriptCore optimization)
  - ESM/CJS dual export strategies

- ✅ **Tooling choices**
  - Test framework selection (Vitest vs. Jest vs. Mocha)
  - Build tooling (tsup vs. rollup vs. esbuild)
  - Linting/formatting (Biome vs. ESLint/Prettier)

- ✅ **TypeScript-specific performance optimizations**
  - Lazy loading with Proxy objects
  - Type guard implementations
  - Generator patterns for large datasets

- ✅ **Module packaging decisions**
  - Dual ESM/CJS export strategy
  - Tree-shaking optimizations
  - Type definition generation

- ✅ **Development experience enhancements**
  - IntelliSense optimization
  - Type inference improvements
  - Auto-completion patterns

## When to Promote to Ecosystem ADR

Promote a local ADR to ecosystem level if:

- ✅ **Decision affects API contracts** shared with gofulmen/pyfulmen
- ✅ **Schema structure or field naming** involved (must be consistent across languages)
- ✅ **Cross-language behavior** consistency required
- ✅ **Pattern applicable** to other language implementations
- ✅ **Breaking change** that needs ecosystem coordination

### Promotion Process

1. **Recognize**: Decision has cross-language impact
2. **Propose**: Create proposal in Crucible `.plans/` referencing this local ADR
3. **Coordinate**: Discuss in `#fulmen-architecture` channel, get buy-in from gofulmen/pyfulmen maintainers
4. **Promote**: Create ecosystem ADR in Crucible with next available `ADR-XXXX` number
5. **Update Local ADR**: Mark as "Superseded by [ADR-XXXX]" with link
6. **Sync**: Run `make sync-ssot` to propagate updated ecosystem ADR to all libraries

## Ecosystem ADR Reference

Ecosystem ADRs from Crucible are synced to:

- **Location**: `docs/crucible-ts/architecture/decisions/`
- **Status**: Read-only (propose changes upstream to Crucible)
- **Sync Command**: `make sync-ssot`

See [Ecosystem ADR Index](../../crucible-ts/architecture/decisions/README.md) for complete list.

## Tracking Ecosystem ADR Adoption

TSFulmen tracks implementation status for ecosystem ADRs in:

- [Ecosystem Adoption Status](ecosystem-adoption-status.md)

This enables ecosystem-wide visibility into which standards TSFulmen has implemented.

## Creating a New Local ADR

### Using Make Target (Recommended)

```bash
make adr-new
# Enter ADR title when prompted (e.g., "use-proxy-for-lazy-loading")
# Edit the generated file and update frontmatter
```

### Manual Creation

1. **Determine Next ID**: Check existing ADRs, use next sequential number
2. **Copy Template**: `cp ../../crucible-ts/architecture/decisions/template.md ADR-XXXX-title.md`
3. **Update Frontmatter**:
   ```yaml
   id: "ADR-XXXX"
   title: "Your Decision Title"
   status: "draft"
   scope: "tsfulmen"
   ```
4. **Fill in Sections**: Context, Decision, Consequences, Alternatives
5. **Update This README**: Add entry to Local ADR Index table

### ADR Format

Use the Crucible standard template from `docs/crucible-ts/architecture/decisions/template.md`.

Required frontmatter fields:

- `id`: "ADR-XXXX" format (matches filename)
- `title`: Clear, concise decision title
- `status`: draft | proposed | accepted | deprecated | superseded
- `scope`: "tsfulmen" (for local ADRs)
- `date`: YYYY-MM-DD
- `authors`: ["Module Weaver"]

## ADR Lifecycle

### Status Flow

```
draft → proposed → accepted → [stable]
                    ↓
                deprecated / superseded
```

### Status Definitions

- **draft**: Initial writing, not ready for review
- **proposed**: Ready for review and discussion
- **accepted**: Approved and implemented
- **deprecated**: No longer recommended but not replaced
- **superseded**: Replaced by another ADR (include link)

## Validation

TSFulmen validates ADR frontmatter and naming:

```bash
make adr-validate
```

This checks:

- Frontmatter matches schema from `schemas/crucible-ts/config/standards/v1.0.0/adr-frontmatter.schema.json`
- Filename ID matches frontmatter `id` field
- Title uses kebab-case format
- Required fields present

## Resources

- [Crucible ADR Standard](../../crucible-ts/architecture/decisions/README.md) - Complete ecosystem ADR guide
- [Fulmen Helper Library Standard](../../crucible-ts/architecture/fulmen-helper-library-standard.md) - ADR requirements for helper libraries
- [Agentic Attribution Standard](../../crucible-ts/standards/agentic-attribution.md) - Commit attribution for ADR changes

---

**Last Updated**: 2025-10-15
**Maintainer**: Module Weaver (@module-weaver)
