# Crucible Shim Module

Ergonomic access to Crucible SSOT assets embedded in TSFulmen.

## Overview

The Crucible module provides a stable interface for consuming Crucible documentation, schemas, and configuration defaults without requiring direct Crucible sync or Goneat bootstrap. All assets are embedded during TSFulmen's build process and accessed through a unified API.

## Installation

```typescript
import {
  getCrucibleVersion,
  listDocumentation,
  getDocumentationWithMetadata,
  loadSchemaById,
  getConfigDefaults,
} from "@fulmenhq/tsfulmen/crucible";
```

## API Reference

### Version Metadata

#### `getCrucibleVersion(): CrucibleVersion`

Returns metadata about the embedded Crucible assets.

```typescript
const version = getCrucibleVersion();
console.log(version.version); // "2025.10.0"
console.log(version.commit); // Git commit hash or "unknown"
console.log(version.syncedAt); // ISO-8601 timestamp or null
console.log(version.dirty); // boolean
console.log(version.syncMethod); // "git-tag" | "git-ref" | "local-path"
```

### Discovery

#### `listCategories(): readonly AssetCategory[]`

Returns all available asset categories.

```typescript
const categories = listCategories();
// ['docs', 'schemas', 'config', 'templates']
```

#### `listAssets(category, options?): Promise<readonly AssetSummary[]>`

Discovers assets in a given category with optional filtering.

```typescript
// List all documentation
const allDocs = await listAssets("docs");

// Filter by prefix
const standards = await listAssets("docs", { prefix: "standards/" });

// Limit results
const recentSchemas = await listAssets("schemas", { limit: 10 });
```

### Documentation

#### `listDocumentation(filters?): Promise<readonly DocumentationSummary[]>`

Lists documentation assets with optional metadata filtering.

```typescript
// All documentation
const docs = await listDocumentation();

// Filter by prefix
const standards = await listDocumentation({ prefix: "standards/" });

// Filter by status
const stableDocs = await listDocumentation({ status: "stable" });

// Filter by tags
const securityDocs = await listDocumentation({ tags: ["security"] });

// Combine filters
const limitedStandards = await listDocumentation({
  prefix: "standards/",
  limit: 5,
});
```

#### `getDocumentation(id): Promise<string>`

Loads raw documentation content including frontmatter.

```typescript
const content = await getDocumentation("standards/agentic-attribution.md");
console.log(content); // Full markdown with frontmatter
```

#### `getDocumentationWithMetadata(id): Promise<{content, metadata}>`

Loads documentation with parsed frontmatter metadata.

```typescript
const result = await getDocumentationWithMetadata("standards/logging.md");

console.log(result.content); // Markdown without frontmatter
console.log(result.metadata?.title); // "Logging Standards"
console.log(result.metadata?.status); // "stable"
console.log(result.metadata?.tags); // ['observability', 'logging']
```

#### `getDocumentationMetadata(id): Promise<DocumentationMetadata | null>`

Retrieves only the frontmatter metadata.

```typescript
const metadata = await getDocumentationMetadata("standards/README.md");
if (metadata) {
  console.log(metadata.title);
  console.log(metadata.author);
  console.log(metadata.lastUpdated);
}
```

### Schemas

#### `listSchemas(kind?): Promise<readonly SchemaSummary[]>`

Lists schema assets with optional kind filtering.

```typescript
// All schemas
const allSchemas = await listSchemas();

// Filter by kind
const loggingSchemas = await listSchemas("observability");
const librarySchemas = await listSchemas("library");
```

#### `loadSchemaById(id): Promise<unknown>`

Loads and parses a schema by ID.

```typescript
// Load schema
const schema = await loadSchemaById(
  "observability/logging/v1.0.0/logger-config",
);

// Use with validation libraries
import Ajv from "ajv";
const ajv = new Ajv();
const validate = ajv.compile(schema);
```

### Configuration

#### `listConfigDefaults(category?): Promise<readonly ConfigSummary[]>`

Lists configuration defaults with optional category filtering.

```typescript
// All configs
const allConfigs = await listConfigDefaults();

// Filter by category
const terminalConfigs = await listConfigDefaults("terminal");
```

#### `getConfigDefaults(category, version): Promise<unknown>`

Loads configuration defaults by category and version.

```typescript
// Load terminal config (accepts with or without 'v' prefix)
const config1 = await getConfigDefaults("terminal", "1.0.0");
const config2 = await getConfigDefaults("terminal", "v1.0.0");

// Both return the same parsed YAML config
console.log(config1);
```

## Error Handling

All loader functions throw `AssetNotFoundError` when assets cannot be found. The error includes similarity-based suggestions:

```typescript
import { AssetNotFoundError } from "@fulmenhq/tsfulmen/crucible";

try {
  await getDocumentation("standards/loging.md"); // Typo
} catch (error) {
  if (error instanceof AssetNotFoundError) {
    console.error(error.message);
    // "Asset not found: docs/standards/loging.md
    //  Did you mean:
    //    - standards/logging.md (85% match)"

    console.log(error.assetId); // "standards/loging.md"
    console.log(error.category); // "docs"
    console.log(error.suggestions); // ["standards/logging.md", ...]
  }
}
```

## Asset ID Conventions

### Documentation

- Keep `.md` extension
- Relative path beneath `docs/crucible-ts/`
- Example: `standards/agentic-attribution.md`

### Schemas

- **No file extension** (`.json`/`.yaml` removed)
- Relative path beneath `schemas/crucible-ts/`
- Example: `observability/logging/v1.0.0/logger-config`

### Configuration

- **No file extension** (`.yaml` removed)
- Relative path beneath `config/crucible-ts/`
- Example: `terminal/v1.0.0/terminal-overrides-defaults`

## Common Patterns

### Finding Standards Documentation

```typescript
const standards = await listDocumentation({ prefix: "standards/" });
for (const doc of standards) {
  const { content, metadata } = await getDocumentationWithMetadata(doc.id);
  if (metadata?.status === "stable") {
    console.log(`${metadata.title}: ${doc.id}`);
  }
}
```

### Loading Related Schemas

```typescript
const loggingSchemas = await listSchemas("observability");
const relevantSchemas = loggingSchemas.filter(
  (s) => s.id.includes("logging") && s.version === "1.0.0",
);

for (const summary of relevantSchemas) {
  const schema = await loadSchemaById(summary.id);
  // Use schema...
}
```

### Config Version Lookup

```typescript
const configs = await listConfigDefaults("terminal");
if (configs.length > 0) {
  const latestConfig = configs[configs.length - 1];
  const config = await getConfigDefaults(
    latestConfig.configCategory,
    latestConfig.version,
  );
  console.log(config);
}
```

## Performance

- **Discovery:** Full category scan <10ms (typical: 2-4ms)
- **Single asset load:** <5ms
- **Parallel discovery:** Efficient with `Promise.all()`

```typescript
// Parallel discovery is fast
const [docs, schemas, configs] = await Promise.all([
  listDocumentation({ limit: 10 }),
  listSchemas("observability"),
  listConfigDefaults("terminal"),
]);
```

## Types

All TypeScript types are exported:

```typescript
import type {
  AssetCategory,
  AssetSummary,
  CrucibleVersion,
  DocumentationMetadata,
  DocumentationSummary,
  SchemaKind,
  SchemaSummary,
  ConfigSummary,
} from "@fulmenhq/tsfulmen/crucible";
```

## Integration with Other Modules

### DocScribe

The Crucible module uses DocScribe for frontmatter extraction:

```typescript
import { getDocumentationWithMetadata } from "@fulmenhq/tsfulmen/crucible";

const { content, metadata } = await getDocumentationWithMetadata(
  "standards/README.md",
);
// Metadata is parsed using DocScribe's frontmatter parser
```

### Foundry Similarity

Error suggestions use Foundry's similarity module:

```typescript
import { AssetNotFoundError } from "@fulmenhq/tsfulmen/crucible";

// Suggestions are ranked by Levenshtein distance and normalized for case
```

## Cross-Language Parity

The Crucible shim maintains API parity with:

- **pyfulmen** (Python helper library)
- **gofulmen** (Go helper library)

Asset IDs, error messages, and metadata structures are consistent across all languages.

## Version Notes

- Current Crucible version: Check with `getCrucibleVersion()`
- Synced assets are embedded during TSFulmen build
- No runtime sync or network fetching
- Assets reflect the Crucible version at build time

## See Also

- [Crucible Shim Standard](../../docs/crucible-ts/standards/library/modules/crucible-shim.md)
- [DocScribe Module](../docscribe/README.md)
- [Foundry Module](../foundry/README.md)
