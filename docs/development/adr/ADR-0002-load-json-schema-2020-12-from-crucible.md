---
id: "ADR-0002"
title: "Load JSON Schema 2020-12 Metaschema from Crucible SSOT"
status: "accepted"
date: "2025-10-20"
last_updated: "2025-10-20"
deciders:
  - "@module-weaver"
  - "@3leapsdave"
scope: "tsfulmen"
tags:
  - "schema-validation"
  - "ajv"
  - "json-schema"
  - "draft-2020-12"
  - "ssot"
related_adrs: []
---

# ADR-0002: Load JSON Schema 2020-12 Metaschema from Crucible SSOT

## Status

**Current Status**: Accepted

## Context

TSFulmen implements schema validation using AJV for Crucible schemas. All Crucible configuration schemas declare `"$schema": "https://json-schema.org/draft/2020-12/schema"` as the standard. However, AJV's default import (`import Ajv from 'ajv'`) targets JSON Schema Draft-07 and does not preload the 2020-12 metaschema, causing compilation failures when loading Crucible schemas.

### Problem

When attempting to compile a Crucible schema with draft 2020-12 declaration:

```typescript
const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.fulmenhq.dev/crucible/ascii/box-chars-v1.0.0.json",
  type: "object",
  // ... properties
};

const validator = ajv.compile(schema);
// Error: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"
```

### Available Solutions

1. **Use AJV 2020 build**: `import Ajv2020 from 'ajv/dist/2020'`
   - Pros: Built-in 2020-12 support
   - Cons: Hardcoded to specific draft, less flexible

2. **Add metaschema from ajv package**: `import meta2020 from 'ajv/dist/refs/json-schema-2020-12.json'`
   - Pros: Official AJV metaschema, well-tested
   - Cons: Tightly coupled to AJV version, not tracking Crucible's canonical schemas

3. **Load metaschema from Crucible SSOT**: Use `schemas/crucible-ts/meta/draft-2020-12/`
   - Pros: Single source of truth, versioned with Crucible sync
   - Cons: Requires file I/O during initialization

### Crucible Metaschema Structure

Crucible maintains curated metaschemas in `schemas/crucible-ts/meta/`:

```
schemas/crucible-ts/meta/
├── draft-07/
│   └── schema.json
├── draft-2020-12/
│   ├── schema.json                  # Main metaschema
│   ├── offline.schema.json          # Minimal offline subset
│   └── meta/                        # Vocabulary schemas
│       ├── core.json
│       ├── applicator.json
│       ├── unevaluated.json
│       ├── validation.json
│       ├── meta-data.json
│       ├── format-annotation.json
│       └── content.json
└── README.md
```

These metaschemas are:

- Fetched from json-schema.org (canonical source)
- Curated and validated by Crucible maintainers
- Licensed for redistribution (json-schema.org terms permit)
- Synced as part of SSOT process

## Decision

**We will load the JSON Schema 2020-12 metaschema from Crucible's SSOT (`schemas/crucible-ts/meta/draft-2020-12/`)** rather than using AJV's bundled metaschema or the 2020 build.

### Implementation

```typescript
async function loadMetaSchema(
  draft: "draft-07" | "draft-2020-12",
): Promise<Record<string, unknown>> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const metaSchemaPath = join(
    __dirname,
    "..",
    "..",
    "schemas",
    "crucible-ts",
    "meta",
    draft,
    "schema.json",
  );

  const content = await readFile(metaSchemaPath, "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

async function loadVocabularySchemas(): Promise<Record<string, unknown>[]> {
  // Load vocabulary schemas from meta/draft-2020-12/meta/
  // Returns: core.json, applicator.json, validation.json, etc.
}

function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
      addUsedSchema: false,
    });

    // Load metaschemas asynchronously
    Promise.all([
      loadMetaSchema("draft-2020-12"),
      loadVocabularySchemas(),
    ]).then(([metaSchema, vocabSchemas]) => {
      ajvInstance.addMetaSchema(metaSchema);
      vocabSchemas.forEach((schema) => ajvInstance.addMetaSchema(schema));
    });
  }

  return ajvInstance;
}
```

### Key Aspects

1. **Async Loading**: Metaschemas loaded asynchronously after AJV initialization
2. **Path Resolution**: Uses `import.meta.url` pattern consistent with other TSFulmen modules
3. **Vocabulary Support**: Loads all 2020-12 vocabulary schemas (core, applicator, validation, etc.)
4. **Fallback Handling**: Silent failures for missing vocabulary schemas (graceful degradation)

## Consequences

### Positive

- **SSOT Compliance**: Tracks Crucible's canonical metaschemas, stays in sync via `make sync-ssot`
- **Version Control**: Metaschema versions tracked in git, auditable changes
- **Consistency**: All Fulmen libraries can follow same pattern (gofulmen, pyfulmen, etc.)
- **Offline Support**: Works without network access (metaschemas bundled)
- **Licensing**: Respects json-schema.org terms (redistribution permitted)

### Negative

- **Async Initialization**: First schema compilation may occur before metaschema loads
  - **Mitigation**: Most production code compiles schemas lazily, metaschema loads quickly
  - **Alternative**: Could block on metaschema load in `compileSchema()` if needed
- **File I/O Overhead**: Small one-time cost to read metaschema files
  - **Impact**: ~7 files × ~2-5KB each = minimal performance impact
- **Path Dependency**: Requires `schemas/crucible-ts/meta/` directory structure
  - **Mitigation**: Standard SSOT sync ensures structure exists

### Risks

1. **Race Condition**: Schema compilation before metaschema loads
   - **Likelihood**: Low (async Promise.all typically fast)
   - **Mitigation**: Add await in `compileSchema()` if issues observed
2. **Missing Metaschema**: `schemas/` not present or incomplete
   - **Likelihood**: Low (bootstrap ensures sync)
   - **Mitigation**: Error handling, fallback to AJV bundled if needed

## Alternatives Considered

### Alternative 1: Use `ajv/dist/2020` Build

```typescript
import Ajv2020 from "ajv/dist/2020";
const ajv = new Ajv2020({ allErrors: true });
```

**Rejected because**:

- Locks to specific draft, less flexible for future schema versions
- Doesn't align with SSOT principle
- Different import path complicates future refactoring

### Alternative 2: Bundle AJV Metaschema

```typescript
import meta2020 from "ajv/dist/refs/json-schema-2020-12.json";
ajv.addMetaSchema(meta2020);
```

**Rejected because**:

- Tightly couples to AJV version
- Bypasses Crucible's curated metaschemas
- Loses SSOT traceability

### Alternative 3: Synchronous Loading with Top-Level Await

```typescript
const metaSchema = await loadMetaSchema("draft-2020-12");
const ajv = new Ajv({
  /* ... */
});
ajv.addMetaSchema(metaSchema);
```

**Rejected because**:

- Complicates module initialization
- Not compatible with all bundlers
- Unnecessary for current use case

## Implementation Notes

### File Structure

Metaschemas loaded from:

```
schemas/crucible-ts/meta/draft-2020-12/
├── schema.json           # Main metaschema ($id: https://json-schema.org/draft/2020-12/schema)
└── meta/
    ├── core.json         # Vocabulary: core
    ├── applicator.json   # Vocabulary: applicator
    ├── validation.json   # Vocabulary: validation
    ├── meta-data.json    # Vocabulary: meta-data
    ├── unevaluated.json  # Vocabulary: unevaluated
    ├── format-annotation.json  # Vocabulary: format-annotation
    └── content.json      # Vocabulary: content
```

### Testing Strategy

1. **Unit Tests**: Verify metaschema loads correctly
2. **Integration Tests**: Validate real Crucible schemas compile
3. **Error Cases**: Handle missing metaschema files gracefully

### Future Enhancements

- **Draft Detection**: Auto-detect schema draft from `$schema` field, load appropriate metaschema
- **Preload Option**: Provide `await loadMetaSchemas()` for explicit initialization
- **Metaschema Caching**: Cache loaded metaschemas across AJV instance resets

## Related Standards

- [Schema Normalization Standard](../../crucible-ts/standards/schema-normalization.md)
- [Schema Validation Module Standard](../../crucible-ts/standards/library/modules/schema-validation.md)
- [Crucible Meta-Schema README](../../schemas/crucible-ts/meta/README.md) (synced via SSOT)

## References

- AJV Documentation: https://ajv.js.org/guide/schema-language.html
- JSON Schema 2020-12 Spec: https://json-schema.org/draft/2020-12/schema
- Crucible SSOT Sync: `.goneat/ssot-consumer.yaml`

---

**Implementation Phase**: S4 (AJV Validator Core)
**Related Commit**: feat(schema): add draft 2020-12 metaschema support
