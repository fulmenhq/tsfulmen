# Fulpack - Archive Operations Module

**Common-tier archive operations** with security-first design for tar, tar.gz, zip, and gzip formats.

Part of the [TSFulmen](../../README.md) helper library ecosystem.

## Quick Start

```typescript
import {
  create,
  extract,
  scan,
  verify,
  info,
  ArchiveFormat,
} from "@fulmenhq/tsfulmen/fulpack";

// Create a tar.gz archive
const archiveInfo = await create(
  "./src", // Source directory
  "./dist/app.tar.gz", // Output archive
  ArchiveFormat.TAR_GZ, // Format
  { compression_level: 9 }, // Options
);

// Extract archive
const result = await extract(
  "./dist/app.tar.gz", // Archive path
  "./output", // Destination
  { overwrite: "skip" }, // Options
);

// Scan archive contents (no extraction)
const entries = await scan("./dist/app.tar.gz");
console.log(`Found ${entries.length} entries`);

// Verify archive integrity
const validation = await verify("./dist/app.tar.gz");
console.log(
  `Valid: ${validation.valid}, Checks: ${validation.checks_performed.join(", ")}`,
);

// Get archive metadata
const metadata = await info("./dist/app.tar.gz");
console.log(
  `Format: ${metadata.format}, ${metadata.entry_count} entries, ${metadata.compression_ratio.toFixed(2)}:1`,
);
```

## Features

### ✅ Five Canonical Operations

- **`create()`** - Create archives from files/directories
- **`extract()`** - Extract archive contents with security checks
- **`scan()`** - List archive entries without extraction (Pathfinder backend)
- **`verify()`** - Validate archive integrity and security
- **`info()`** - Get archive metadata quickly

### ✅ Four Formats

- **TAR** (uncompressed) - Maximum speed, streaming, pre-compressed data
- **TAR.GZ** (tar + gzip) - General purpose, best compatibility
- **ZIP** - Windows compatibility, random access
- **GZIP** - Single file compression

### ✅ Security First

- **Path traversal protection** - Rejects `../` and absolute paths
- **Decompression bomb detection** - Size/ratio/entry count limits
- **Symlink safety validation** - Prevents directory escapes
- **Checksum verification** - SHA-256 cryptographic validation (via fulhash)

### ✅ Enterprise Ready

- **TypeScript strict mode** - Full type safety
- **Comprehensive error handling** - Structured FulpackError with context
- **Progressive logging** - Operation tracing and debugging
- **Telemetry integration** - Complete observability surface

## API Reference

### create()

Create an archive from source files or directories.

```typescript
function create(
  source: string | string[],
  output: string,
  format: ArchiveFormat,
  options?: CreateOptions,
): Promise<ArchiveInfo>;
```

**Parameters:**

- `source` - Single file/directory path or array of paths
- `output` - Output archive path
- `format` - `ArchiveFormat.TAR | TAR_GZ | ZIP | GZIP`
- `options` - Optional configuration

**Options:**

```typescript
interface CreateOptions {
  compression_level?: number; // 1-9, default 6 (ignored for TAR)
  checksum_algorithm?: string; // "sha256" (default) | "xxh3-128"
  preserve_permissions?: boolean; // Default true (TAR/TAR.GZ only)
  follow_symlinks?: boolean; // Default false (security)
  include_patterns?: string[]; // Glob patterns to include
  exclude_patterns?: string[]; // Glob patterns to exclude
}
```

**Returns:**

```typescript
interface ArchiveInfo {
  format: "tar" | "tar.gz" | "zip" | "gzip";
  compression: "gzip" | "deflate" | "none";
  entry_count: number;
  total_size: number; // Uncompressed bytes
  compressed_size: number; // Archive file size
  compression_ratio: number; // compressed_size / total_size
  has_checksums: boolean;
  created: string; // ISO 8601 timestamp
}
```

**Example:**

```typescript
// Create TAR (uncompressed) - fastest
await create("./data", "./backup.tar", ArchiveFormat.TAR);

// Create TAR.GZ with max compression
await create("./src", "./release.tar.gz", ArchiveFormat.TAR_GZ, {
  compression_level: 9,
  exclude_patterns: ["**/*.test.ts", "**/node_modules/**"],
});

// Create ZIP for Windows
await create(["./config", "./scripts"], "./deploy.zip", ArchiveFormat.ZIP);

// Compress single file
await create("./large-data.csv", "./large-data.csv.gz", ArchiveFormat.GZIP, {
  compression_level: 9,
});
```

### extract()

Extract archive contents to a destination directory with security checks.

```typescript
function extract(
  archive: string,
  destination: string,
  options?: ExtractOptions,
): Promise<ExtractResult>;
```

**Parameters:**

- `archive` - Path to archive file
- `destination` - Destination directory (must be explicit, will be created if needed)
- `options` - Optional configuration

**Options:**

```typescript
interface ExtractOptions {
  overwrite?: "error" | "skip" | "overwrite"; // Default "error"
  verify_checksums?: boolean; // Default true
  preserve_permissions?: boolean; // Default true
  max_size?: number; // Default 1GB
  max_entries?: number; // Default 100k
  include_patterns?: string[]; // Filter entries
}
```

**Returns:**

```typescript
interface ExtractResult {
  extracted_count: number;
  skipped_count: number;
  error_count: number;
  errors?: FulpackError[];
  warnings?: string[];
}
```

**Security Checks:**

- ✅ Path traversal detection (`../`, absolute paths)
- ✅ Symlink escape validation
- ✅ Decompression bomb detection (size, ratio, entry count)
- ✅ Checksum verification (if present in archive)

**Example:**

```typescript
// Extract with defaults (error on existing files)
await extract("./backup.tar.gz", "./restore");

// Extract and skip existing files
const result = await extract("./data.tar.gz", "./output", {
  overwrite: "skip",
});
console.log(
  `Extracted ${result.extracted_count}, skipped ${result.skipped_count}`,
);

// Extract specific files only
await extract("./release.zip", "./deploy", {
  include_patterns: ["bin/**", "config/**"],
  max_size: 500 * 1024 * 1024, // 500MB limit
});

// Extract without checksum verification (faster, less secure)
await extract("./untrusted.tar.gz", "./temp", {
  verify_checksums: false,
  max_size: 10 * 1024 * 1024, // 10MB limit for untrusted sources
});
```

### scan()

List archive contents without extraction. Reads table of contents (TOC) only.

**Performance:** <1s target for TOC read, regardless of archive size.

```typescript
function scan(archive: string, options?: ScanOptions): Promise<ArchiveEntry[]>;
```

**Parameters:**

- `archive` - Path to archive file
- `options` - Optional configuration

**Options:**

```typescript
interface ScanOptions {
  include_metadata?: boolean; // Default true (include size/mode/checksum)
  entry_types?: EntryType[]; // Filter by type
  max_depth?: number | null; // Max directory nesting
  max_entries?: number; // Default 100k (security limit)
}
```

**Returns:**

```typescript
interface ArchiveEntry {
  path: string; // Relative path (normalized)
  type: "file" | "directory" | "symlink";
  size: number; // Uncompressed size
  compressed_size?: number; // Compressed size (if available)
  modified: string; // ISO 8601 timestamp
  checksum?: string; // SHA-256 hex (if present)
  mode?: string; // Unix permissions (e.g., "0644")
  symlink_target?: string; // Target path (for symlinks)
}
```

**Edge Case Handling:**

- **Symlinks**: Included with type "symlink", not followed
- **Invalid UTF-8**: Normalized with U+FFFD replacement
- **Absolute paths**: Stripped and included with warning
- **Path traversal**: Included in results (validation in verify/extract)

**Example:**

```typescript
// Basic scan
const entries = await scan("./data.tar.gz");
console.log(`Archive contains ${entries.length} entries`);

// Filter files only
const files = await scan("./backup.zip", {
  entry_types: [EntryType.FILE],
});

// Manual pattern matching
const csvFiles = entries.filter(
  (e) => e.type === "file" && e.path.endsWith(".csv"),
);

// Check for specific file
const hasConfig = entries.some((e) => e.path === "config/app.json");

// Get total uncompressed size
const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
```

### verify()

Validate archive integrity and perform security checks without extraction.

```typescript
function verify(
  archive: string,
  options?: Record<string, unknown>,
): Promise<ValidationResult>;
```

**Returns:**

```typescript
interface ValidationResult {
  valid: boolean;
  errors: FulpackError[]; // Structure failures, security violations
  warnings: string[]; // Missing checksums, unusual ratios
  entry_count: number;
  checksums_verified: number;
  checks_performed: (
    | "structure_valid"
    | "checksums_verified"
    | "no_path_traversal"
    | "no_decompression_bomb"
    | "symlinks_safe"
  )[];
}
```

**Security Checks Performed:**

- ✅ `structure_valid` - Archive parseable and non-empty
- ✅ `no_path_traversal` - No `../` or absolute paths
- ✅ `symlinks_safe` - Symlink targets don't escape
- ✅ `no_decompression_bomb` - Ratio <100:1, size <1GB, entries <100k
- ✅ `checksums_verified` - Verify checksums if present

**Example:**

```typescript
// Validate before extraction
const validation = await verify("./untrusted.tar.gz");

if (!validation.valid) {
  console.error("Archive validation failed:");
  validation.errors.forEach((err) =>
    console.error(`  - ${err.code}: ${err.message}`),
  );
  process.exit(1);
}

// Check for warnings
if (validation.warnings.length > 0) {
  console.warn("Warnings:", validation.warnings);
}

// Verify checks performed
console.log("Security checks:", validation.checks_performed.join(", "));
```

### info()

Get archive metadata quickly without extraction.

```typescript
function info(archive: string): Promise<ArchiveInfo>;
```

**Example:**

```typescript
const metadata = await info("./backup.tar.gz");

console.log(`Format: ${metadata.format}`);
console.log(`Entries: ${metadata.entry_count}`);
console.log(
  `Compressed: ${(metadata.compressed_size / 1024 / 1024).toFixed(2)} MB`,
);
console.log(
  `Uncompressed: ${(metadata.total_size / 1024 / 1024).toFixed(2)} MB`,
);
console.log(`Ratio: ${metadata.compression_ratio.toFixed(2)}:1`);
console.log(`Checksums: ${metadata.has_checksums ? "yes" : "no"}`);
```

## Pathfinder Integration

Fulpack's `scan()` operation serves as the backend for [Pathfinder](../pathfinder/README.md) archive discovery.

### Direct Usage

```typescript
import { scan } from "@fulmenhq/tsfulmen/fulpack";

// Scan archive
const entries = await scan("./data.tar.gz", {
  include_metadata: true,
  entry_types: ["file"],
});

// Apply custom filtering
const csvFiles = entries.filter((e) => e.path.endsWith(".csv"));
```

### Pathfinder Integration Pattern

```typescript
import { find } from "@fulmenhq/tsfulmen/pathfinder";

// Unified API - works for filesystem AND archives
const results = await find({
  source: "./data.tar.gz", // Archive path
  pattern: "**/*.csv",
  include_metadata: true,
});

// Pathfinder workflow:
// 1. Detects archive format
// 2. Calls fulpack.scan("./data.tar.gz")
// 3. Receives ArchiveEntry[]
// 4. Applies glob pattern to entry paths
// 5. Returns matching entries
```

### Mixed Queries (Filesystem + Archives)

```typescript
// Search across multiple sources
const results = await find({
  sources: [
    "./src", // Filesystem directory
    "./data.tar.gz", // Archive
    "./backup.zip", // Another archive
  ],
  pattern: "**/*.ts",
});
```

## Format Selection Guide

| Format     | Use Case                                    | Speed          | Compression   | Windows | Random Access |
| ---------- | ------------------------------------------- | -------------- | ------------- | ------- | ------------- |
| **TAR**    | Pre-compressed data, streaming              | ⚡⚡⚡ Fastest | None (1.0:1)  | ✅      | ❌            |
| **TAR.GZ** | General purpose, best compatibility         | ⚡⚡ Fast      | Good (varies) | ✅      | ❌            |
| **ZIP**    | Windows compatibility, selective extraction | ⚡ Moderate    | Good (varies) | ✅✅    | ✅            |
| **GZIP**   | Single file compression only                | ⚡⚡ Fast      | Good (varies) | ✅      | ❌            |

**Recommendations:**

- **TAR**: Use for maximum speed when data is already compressed (images, videos, pre-built binaries)
- **TAR.GZ**: Default choice for general archiving and distribution
- **ZIP**: Use when Windows compatibility or random access is required
- **GZIP**: Single file compression only (not for directories)

## Security Considerations

### Path Traversal Protection

Fulpack **rejects** path traversal attempts during `extract()` and `verify()`:

```typescript
// These will be rejected:
// - "../../../etc/passwd"
// - "/etc/passwd"
// - "C:/Windows/System32/config"
```

During `scan()`, traversal attempts are **included** in results (for inspection), but flagged during verification.

### Decompression Bomb Detection

Protects against malicious archives with extreme compression ratios:

```typescript
// Default limits:
// - max_size: 1GB uncompressed
// - max_entries: 100,000 entries
// - compression_ratio: warns if >100:1

// Override for specific use cases:
await extract("./large-dataset.tar.gz", "./output", {
  max_size: 10 * 1024 * 1024 * 1024, // 10GB
  max_entries: 500000,
});
```

### Symlink Safety

Symlinks are:

- **Detected** during scan (included with type "symlink")
- **Not followed** by default (security)
- **Validated** during extract/verify (targets must stay within destination)

```typescript
// Safe: symlink to "./config/app.json"
// Unsafe: symlink to "../../../etc/passwd" (rejected)
```

### Checksum Verification

Archives created with checksums are automatically verified during extraction:

```typescript
// Create with checksums (default: SHA-256)
await create("./src", "./release.tar.gz", ArchiveFormat.TAR_GZ);

// Extract with verification (default: enabled)
await extract("./release.tar.gz", "./deploy"); // Verifies checksums

// Skip verification (faster, less secure)
await extract("./release.tar.gz", "./deploy", {
  verify_checksums: false,
});
```

## Error Handling

All operations throw `FulpackOperationError` with structured context:

```typescript
import { FulpackOperationError } from "@fulmenhq/tsfulmen/fulpack";

try {
  await extract("./archive.tar.gz", "./output");
} catch (error) {
  if (error instanceof FulpackOperationError) {
    console.error(`Operation: ${error.error.operation}`);
    console.error(`Code: ${error.error.code}`);
    console.error(`Message: ${error.error.message}`);
    console.error(`Archive: ${error.error.archive}`);

    // Handle specific errors
    if (error.error.code === "PATH_TRAVERSAL") {
      console.error("Security violation: path traversal attempt");
    }
  }
}
```

**Error Codes:**

- `INVALID_ARCHIVE_FORMAT` - Unsupported format
- `ARCHIVE_NOT_FOUND` - Archive file doesn't exist
- `ARCHIVE_CORRUPT` - Archive structure invalid
- `PATH_TRAVERSAL` - Security violation detected
- `DECOMPRESSION_BOMB` - Size/ratio/entry limits exceeded
- `CHECKSUM_MISMATCH` - Checksum verification failed
- `EXTRACTION_FAILED` - File write error
- `SOURCE_NOT_FOUND` - Source file doesn't exist (create)
- `INVALID_OPTIONS` - Invalid options provided

## Performance Tips

1. **Use TAR for speed**: Uncompressed TAR is fastest for both creation and extraction
2. **Adjust compression**: Lower levels (1-3) for speed, higher (7-9) for size
3. **Scan before extract**: Use `scan()` to check contents before extracting
4. **Pattern filtering**: Apply patterns early to reduce processing
5. **Skip checksums**: Disable `verify_checksums` for trusted sources

```typescript
// Fast extraction for trusted sources
await extract("./trusted.tar.gz", "./output", {
  verify_checksums: false, // Skip checksum verification
  preserve_permissions: false, // Skip permission handling
});

// Fast archiving with low compression
await create("./data", "./quick.tar.gz", ArchiveFormat.TAR_GZ, {
  compression_level: 1, // Fastest compression
});
```

## See Also

- [Pathfinder Module](../pathfinder/README.md) - File discovery and glob matching
- [FulHash Module](../fulhash/README.md) - Checksum generation and verification
- [Crucible Fulpack Standard](../../docs/crucible-ts/standards/library/modules/fulpack.md)
- [Feature Brief](.plans/active/v0.1.9/fulpack-module-feature-brief.md)

---

**Module Weaver** 🧵 | Generated with [Claude Code](https://claude.com/claude-code) | Supervised by @3leapsdave
