# FulHash Module

Fast, consistent hashing API for the Fulmen ecosystem supporting block and streaming operations with SHA-256 and XXH3-128 algorithms.

## Features

- ✅ **Block Hashing**: One-shot hashing for complete data
- ✅ **Streaming API**: Incremental hashing for chunked data
- ✅ **Checksum Validation**: Parse and verify formatted checksums
- ✅ **Cross-Language Compatible**: Identical results with gofulmen and pyfulmen
- ✅ **Concurrency Safe**: Thread-safe factory pattern for WASM instances
- ✅ **Type Safe**: Full TypeScript support with strict types

## Algorithms

| Algorithm    | Size     | Speed       | Use Case                            |
| ------------ | -------- | ----------- | ----------------------------------- |
| **SHA-256**  | 32 bytes | 426 MB/s    | Cryptographic integrity, signatures |
| **XXH3-128** | 16 bytes | 16,000 MB/s | Content addressing, deduplication   |

**Security Note**:

- ✅ Use SHA-256 for cryptographic security (integrity verification, signatures)
- ⚠️ Do NOT use XXH3-128 for security (fast but non-cryptographic)

## Quick Start

### Block Hashing

```typescript
import { hash, Algorithm } from "@fulmenhq/tsfulmen/fulhash";

// SHA-256 (default, cryptographic)
const sha = await hash("Hello, World!");
console.log(sha.formatted);
// => sha256:dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f

// XXH3-128 (fast, non-cryptographic)
const xxh = await hash("Hello, World!", { algorithm: Algorithm.XXH3_128 });
console.log(xxh.formatted);
// => xxh3-128:531df2844447dd5077db03842cd75395

// Binary data
const data = new Uint8Array([0x01, 0x02, 0x03]);
const digest = await hash(data);
```

### Streaming API

```typescript
import { createStreamHasher, Algorithm } from "@fulmenhq/tsfulmen/fulhash";

// Create hasher
const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });

// Update incrementally
hasher.update("Hello, ");
hasher.update("World!");

// Finalize
const digest = hasher.digest();
console.log(digest.formatted);
// => sha256:dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f

// Reset and reuse
hasher.reset();
hasher.update("New data").digest();
```

### Checksum Validation

```typescript
import { Digest } from "@fulmenhq/tsfulmen/fulhash";

// Parse checksum
const checksum =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const digest = Digest.parse(checksum);

console.log(digest.algorithm); // Algorithm.SHA256
console.log(digest.hex); // 'e3b0c44...'

// Verify data against checksum
const data = "test data";
const isValid = await Digest.verify(data, checksum);
// => true if data matches checksum

// Compare digests
const d1 = await hash("test");
const d2 = Digest.parse(d1.formatted);
d1.equals(d2); // => true
```

## API Reference

### Block Hashing Functions

#### `hash(input, options?): Promise<Digest>`

Hash data in one operation.

```typescript
const digest = await hash("data", {
  algorithm: Algorithm.SHA256, // Optional, defaults to SHA256
  encoding: "utf8", // Optional, for string inputs
});
```

**Parameters**:

- `input`: `string | Uint8Array` - Data to hash
- `options.algorithm?`: `Algorithm` - Hash algorithm (default: `SHA256`)
- `options.encoding?`: `BufferEncoding` - Encoding for string input (default: `utf8`)

**Returns**: `Promise<Digest>` - Hash result

#### `hashString(str, options?): Promise<Digest>`

Convenience wrapper for hashing strings.

```typescript
const digest = await hashString("Hello, World!");
```

#### `hashBytes(data, options?): Promise<Digest>`

Convenience wrapper for hashing byte arrays.

```typescript
const digest = await hashBytes(new Uint8Array([0x01, 0x02]));
```

### Streaming API

#### `createStreamHasher(options?): Promise<StreamHasher>`

Create a streaming hasher for incremental hashing.

```typescript
const hasher = await createStreamHasher({
  algorithm: Algorithm.XXH3_128,
});
```

**Returns**: `Promise<StreamHasher>` with methods:

##### `update(data): StreamHasher`

Add data to hash computation (chainable).

```typescript
hasher.update("chunk1").update("chunk2").update("chunk3");
```

##### `digest(): Digest`

Finalize and return hash result. Cannot update after digest.

```typescript
const digest = hasher.digest();
```

##### `reset(): StreamHasher`

Reset hasher for reuse (chainable).

```typescript
hasher.reset().update("new data");
```

### Digest Class

#### `Digest.parse(formatted): Digest`

Parse a formatted checksum string.

```typescript
const digest = Digest.parse("sha256:abc123...");
```

**Throws**:

- `InvalidChecksumFormatError` - Invalid format (missing `:`, wrong structure)
- `UnsupportedAlgorithmError` - Unknown algorithm
- `InvalidChecksumError` - Invalid hex (uppercase, wrong length, invalid chars)

#### `Digest.verify(data, checksum): Promise<boolean>`

Verify data matches checksum.

```typescript
const isValid = await Digest.verify("data", "sha256:abc123...");
```

#### `digest.equals(other): boolean`

Compare two digests for equality.

```typescript
const match = digest1.equals(digest2);
```

#### Digest Properties

```typescript
digest.algorithm; // Algorithm enum value
digest.hex; // Lowercase hexadecimal string
digest.bytes; // Uint8Array (copy, safe to mutate)
digest.formatted; // "algorithm:hex" format
```

## Checksum Format

All checksums use the format: `algorithm:hex`

```
sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
xxh3-128:99aa06d3014798d86001c324468d497f
```

**Rules**:

- Algorithm name must be supported (`sha256`, `xxh3-128`)
- Hex must be lowercase
- Hex length: SHA-256=64 chars (32 bytes), XXH3-128=32 chars (16 bytes)

## Error Handling

### Error Types

```typescript
import {
  FulHashError, // Base error class
  UnsupportedAlgorithmError, // Unknown algorithm
  InvalidChecksumError, // Invalid checksum
  InvalidChecksumFormatError, // Malformed checksum string
  DigestStateError, // Invalid hasher state
} from "@fulmenhq/tsfulmen/fulhash";
```

### Common Error Scenarios

```typescript
// Unsupported algorithm
try {
  await hash("data", { algorithm: "md5" as any });
} catch (error) {
  // UnsupportedAlgorithmError: Unsupported algorithm "md5"
}

// Invalid checksum format
try {
  Digest.parse("invalid-no-separator");
} catch (error) {
  // InvalidChecksumFormatError: Invalid checksum "invalid-no-separator"
}

// Update after digest
const hasher = await createStreamHasher();
hasher.update("data").digest();
try {
  hasher.update("more"); // ❌ Error
} catch (error) {
  // DigestStateError: Cannot update after digest()
}
```

## Performance

### Benchmarks

Measured on Apple M1, Node.js v22:

| Operation         | SHA-256  | XXH3-128    | Notes                          |
| ----------------- | -------- | ----------- | ------------------------------ |
| Small (32 bytes)  | 64 MB/s  | 102 MB/s    | Instance overhead dominates    |
| Large (1 MB)      | 426 MB/s | 16,000 MB/s | **37x faster** for large files |
| Instance creation | N/A      | ~0.5ms      | WASM initialization            |

**Recommendation**: Use XXH3-128 for large file hashing (deduplication, content addressing). Use SHA-256 for integrity verification.

## Concurrency Safety

All FulHash APIs are **concurrency-safe**:

```typescript
// Safe: Concurrent hash operations
const results = await Promise.all([
  hash("data-1"),
  hash("data-2"),
  hash("data-3"),
]);

// Safe: Concurrent stream hashers
const [h1, h2] = await Promise.all([
  createStreamHasher(),
  createStreamHasher(),
]);
h1.update("independent");
h2.update("data");
```

Each hash operation creates an isolated instance (factory pattern). See `CONCURRENCY.md` for details.

## Cross-Language Compatibility

FulHash produces identical results across all Fulmen ecosystem implementations:

- **gofulmen** (Go): Uses stdlib `crypto/sha256` and `xxhash` library
- **pyfulmen** (Python): Uses `hashlib` and `xxhash` library
- **tsfulmen** (TypeScript): Uses Node.js `crypto` and `hash-wasm`

All implementations validate against shared fixtures in `config/crucible-ts/library/fulhash/fixtures.yaml`.

## Examples

### File Hashing

```typescript
import { createReadStream } from "fs";
import { createStreamHasher, Algorithm } from "@fulmenhq/tsfulmen/fulhash";

async function hashFile(path: string) {
  const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });
  const stream = createReadStream(path);

  for await (const chunk of stream) {
    hasher.update(chunk);
  }

  return hasher.digest();
}

const digest = await hashFile("./README.md");
console.log(digest.formatted);
```

### Content-Defined Chunking

```typescript
import { hash, Algorithm } from "@fulmenhq/tsfulmen/fulhash";

async function chunkFingerprint(data: Uint8Array) {
  // Use fast XXH3-128 for chunking decisions
  const digest = await hash(data, { algorithm: Algorithm.XXH3_128 });

  // Use hash to determine chunk boundaries
  const lastByte = digest.bytes[digest.bytes.length - 1];
  return (lastByte & 0x0f) === 0; // Chunk boundary every ~16 blocks
}
```

### Integrity Verification

```typescript
import { Digest, hash } from "@fulmenhq/tsfulmen/fulhash";

async function verifyDownload(url: string, expectedChecksum: string) {
  const response = await fetch(url);
  const data = await response.arrayBuffer();

  const isValid = await Digest.verify(new Uint8Array(data), expectedChecksum);

  if (!isValid) {
    throw new Error(`Checksum mismatch for ${url}`);
  }

  return data;
}

await verifyDownload("https://example.com/file.tar.gz", "sha256:abc123...");
```

## Testing

```bash
# Run all fulhash tests
bunx vitest run src/fulhash/__tests__/

# Run specific test suites
bunx vitest run src/fulhash/__tests__/hash.test.ts           # Block hashing
bunx vitest run src/fulhash/__tests__/stream.test.ts         # Streaming
bunx vitest run src/fulhash/__tests__/digest-format.test.ts  # Formatting
bunx vitest run src/fulhash/__tests__/xxh3-concurrency.test.ts # Concurrency
```

## Documentation

- **Standard**: `docs/crucible-ts/standards/library/modules/fulhash.md`
- **Fixtures**: `config/crucible-ts/library/fulhash/fixtures.yaml`
- **Concurrency**: `src/fulhash/CONCURRENCY.md`
- **ADR-0003**: Hash Library Selection (Native vs WASM)
- **ADR-0004**: Concurrency Safety (Factory Pattern)

## Implementation Status

- ✅ Phase 0: Foundation & Type Contracts (18 tests)
- ✅ Phase 1: SHA-256 Block Hashing (58 tests)
- ✅ Phase 2: XXH3-128 Block Hashing (69 tests)
- ✅ Phase 3: Streaming API (31 tests)
- ✅ Phase 4: Digest & Metadata (30 tests)
- ✅ Phase 5: Integration & Polish (In Progress)

**Total**: 842 tests passing

## License

See repository LICENSE file.
