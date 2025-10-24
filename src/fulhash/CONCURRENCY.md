# FulHash Concurrency Safety

## Overview

The `fulhash` module is designed to be **concurrency-safe** in Node.js environments. This document explains the concurrency model, thread safety guarantees, and implementation details.

## Thread Safety Guarantees

### ✅ Safe for Concurrent Use

All `fulhash` APIs are safe for concurrent invocations:

```typescript
// Safe: Multiple concurrent hash operations
const results = await Promise.all([
  hash("data-1", { algorithm: Algorithm.XXH3_128 }),
  hash("data-2", { algorithm: Algorithm.XXH3_128 }),
  hash("data-3", { algorithm: Algorithm.XXH3_128 }),
]);

// Each operation receives isolated state
// Results are deterministic and correct
```

### Implementation Strategy

We use a **factory pattern** that creates fresh WASM instances per hash operation:

```typescript
// INCORRECT (v0.1.2-beta): Shared singleton
let wasmInstance: IHasher | null = null;
export function getWasmInstance(): IHasher {
  return wasmInstance; // ❌ Multiple calls share state
}

// CORRECT (v0.1.2): Factory pattern
export async function createHasher(): Promise<IHasher> {
  return createXXHash128(); // ✅ Fresh instance per call
}
```

## Why This Matters

### Race Condition Without Isolation

Without per-call isolation, concurrent hash operations would corrupt each other:

```typescript
// Hypothetical broken implementation
const hasher = getSharedHasher();

// Operation 1                    // Operation 2
hasher.init(); //
hasher.update("data-1"); // hasher.init(); ← Resets state!
// hasher.update('data-2');
const digest1 = hasher.digest(); // ← Gets hash of 'data-2' instead!
// const digest2 = hasher.digest();
```

**Result**: Nondeterministic, incorrect digests under load.

### With Isolation (Current Implementation)

Each operation gets its own hasher instance:

```typescript
// Operation 1 - Creates hasher1
const hasher1 = await createHasher();
hasher1.init();
hasher1.update("data-1");
const digest1 = hasher1.digest(); // ✅ Correct

// Operation 2 - Creates hasher2
const hasher2 = await createHasher();
hasher2.init();
hasher2.update("data-2");
const digest2 = hasher2.digest(); // ✅ Correct
```

**Result**: Deterministic, correct digests under all concurrency patterns.

## JavaScript Concurrency Model

### Single-Threaded Event Loop

Node.js runs JavaScript on a single thread with an event loop:

```
Event Loop:
┌─────────────────────┐
│  Call Stack         │
│  ┌──────────┐       │
│  │ hashBytes│       │
│  │ .init()  │       │
│  │ .update()│       │
│  │ .digest()│       │
│  └──────────┘       │
├─────────────────────┤
│  Microtask Queue    │
│  [Promise callbacks]│
└─────────────────────┘
```

**Key Properties**:

- ✅ **No true parallelism**: Only one JavaScript operation runs at a time
- ✅ **No preemption**: Operations run to completion
- ✅ **Deterministic scheduling**: Microtasks (Promises) drain before next macrotask

### Why Promise.all Doesn't Cause Races

```typescript
await Promise.all([
  hash("a"), // ← Starts
  hash("b"), // ← Starts
]);
```

**Execution Order**:

1. `hash('a')` calls `createHasher()` → returns Promise
2. `hash('b')` calls `createHasher()` → returns Promise
3. Event loop waits for both Promises to resolve
4. Each hash operation runs **sequentially** when WASM is ready

**Result**: Even though both start "concurrently", they don't actually interleave because JavaScript is single-threaded.

## Worker Threads Considerations

### Not Covered by This Implementation

Node.js `worker_threads` enable **true parallelism**:

```typescript
// worker.js
import { hash } from "@fulmenhq/tsfulmen/fulhash";

// Each worker has its own V8 isolate
// No shared memory between workers
const result = await hash(workerData.input);
parentPort.postMessage(result);
```

**Thread Safety**:

- ✅ Each worker has its own JavaScript heap
- ✅ No shared state between workers
- ✅ WASM instances are worker-local
- ✅ Safe by design (isolation)

### SharedArrayBuffer Scenarios

If future versions use `SharedArrayBuffer` for shared memory:

```typescript
// Hypothetical: Shared memory between workers
const sharedBuffer = new SharedArrayBuffer(1024);
const sharedArray = new Uint8Array(sharedBuffer);

// Worker 1
await hash(sharedArray.subarray(0, 512));

// Worker 2 (concurrent)
await hash(sharedArray.subarray(512, 1024));
```

**Thread Safety**:

- ✅ Still safe because each hash operation creates isolated WASM instance
- ✅ Input data is copied into WASM memory
- ✅ No shared mutable state in hash computation

**Future Consideration**: If we add reusable hasher pools, will need explicit locking.

## Performance Implications

### Instance Creation Overhead

Creating fresh WASM instances has measurable cost:

| Operation                      | Time                           |
| ------------------------------ | ------------------------------ |
| First `createXXHash128()`      | ~5-10ms (WASM initialization)  |
| Subsequent `createXXHash128()` | ~0.1-0.5ms (instance creation) |
| `hasher.update()` + `digest()` | ~0.01-0.1ms (actual hashing)   |

**Trade-off**: ~0.1-0.5ms overhead per hash vs. correctness

### When This Matters

**High throughput scenarios** (>1000 hashes/sec):

- Instance creation becomes measurable overhead
- Consider batching if possible

**Typical use cases** (file integrity, content addressing):

- Overhead is negligible compared to I/O
- Correctness is paramount

### Future Optimization: Instance Pooling

If profiling shows instance creation is a bottleneck:

```typescript
// Possible future optimization
class HasherPool {
  private available: IHasher[] = [];
  private inUse = new Set<IHasher>();

  async acquire(): Promise<IHasher> {
    let hasher = this.available.pop();
    if (!hasher) {
      hasher = await createXXHash128();
    }
    this.inUse.add(hasher);
    return hasher;
  }

  release(hasher: IHasher): void {
    this.inUse.delete(hasher);
    this.available.push(hasher);
  }
}
```

**Requirements**:

- ✅ Must guarantee no concurrent use of same instance
- ✅ Must reset state between uses (`.init()`)
- ✅ Must handle errors (don't return corrupted instances to pool)

**Current Decision**: Premature optimization. Simple factory is sufficient.

## Testing Strategy

### Concurrency Tests

File: `src/fulhash/__tests__/xxh3-concurrency.test.ts`

**Test Categories**:

1. **Concurrent Hash Calls**: Multiple `hash()` calls with `Promise.all`
2. **Different Data Streams**: Ensure no data mixing between operations
3. **High Concurrency**: 50+ concurrent operations with same input
4. **Determinism**: 100 operations should match sequential baseline
5. **Interleaved Operations**: Alternating different inputs
6. **Direct Algorithm Access**: Test `xxh3.hashBytes()` directly

**Coverage**: 6 concurrency-specific tests, 781 total tests

### How to Verify

Run concurrency tests:

```bash
make test  # Includes concurrency tests
bunx vitest run src/fulhash/__tests__/xxh3-concurrency.test.ts
```

Expected: All tests pass consistently (no flakiness)

### Stress Testing

For production deployment, consider:

```typescript
// Stress test: 10,000 concurrent hashes
const inputs = Array.from({ length: 10000 }, (_, i) => `test-${i}`);
const results = await Promise.all(
  inputs.map((input) => hash(input, { algorithm: Algorithm.XXH3_128 })),
);

// Verify all unique inputs produce unique hashes
const uniqueHashes = new Set(results.map((r) => r.hex));
expect(uniqueHashes.size).toBe(inputs.length);
```

## Algorithm-Specific Notes

### SHA-256 (Node.js crypto)

**Implementation**: `crypto.createHash('sha256')`

**Thread Safety**:

- ✅ Each call to `createHash()` returns new instance
- ✅ Node.js crypto is thread-safe by design
- ✅ No shared state

**Concurrency Model**: Same factory pattern as XXH3-128

### XXH3-128 (hash-wasm)

**Implementation**: `createXXHash128()` from hash-wasm

**Thread Safety**:

- ✅ Each call creates new WASM instance
- ✅ WASM memory is instance-local
- ✅ No global state

**WASM Details**:

- Each instance allocates its own linear memory
- State (hash accumulator) stored in WASM memory
- JavaScript only holds reference to WASM instance

### Future Algorithms (BLAKE3, SHA-512, etc.)

**Requirement**: All algorithms must follow factory pattern

```typescript
// Template for new algorithms
export async function hashBytes(data: Uint8Array): Promise<Uint8Array> {
  await initializeWasm();
  const hasher = await createHasher(); // ✅ Fresh instance

  hasher.init();
  hasher.update(data);
  return hasher.digest("binary");
}
```

**Rationale**: Consistent concurrency guarantees across all algorithms

## Security Considerations

### No Side-Channel Attacks via Shared State

Because each operation uses isolated instances:

- ✅ No timing-based information leakage between operations
- ✅ No cache-based side channels (each instance has own memory)
- ✅ Safe for hashing sensitive data concurrently

### Memory Isolation

```typescript
// Operation 1: Hash secret data
const secret = Buffer.from("secret-password");
const secretHash = await hash(secret);

// Operation 2: Hash public data (concurrent)
const public = Buffer.from("public-data");
const publicHash = await hash(public);

// ✅ No possibility of secret leaking into public hash
// ✅ Separate WASM memory regions
```

## Summary

### Concurrency Safety Checklist

- ✅ **Factory Pattern**: Fresh instances per operation
- ✅ **No Shared State**: Each hasher is isolated
- ✅ **JavaScript Single-Threaded**: Event loop prevents races
- ✅ **Worker-Safe**: Each worker has own heap
- ✅ **Comprehensive Tests**: 6 concurrency tests
- ✅ **Documented**: Clear guarantees and rationale

### Design Principles

1. **Correctness over Performance**: Guarantee safety first
2. **Explicit Isolation**: Don't rely on JavaScript quirks
3. **Future-Proof**: Works with worker_threads and future APIs
4. **Testable**: Clear concurrency test suite
5. **Documented**: Users understand guarantees

### When to Revisit

Consider optimizations (instance pooling) when:

- Profiling shows >5% time in instance creation
- Throughput requirements exceed 1000 hashes/sec
- Memory pressure from many concurrent operations

Until then: **Keep it simple, keep it safe.**

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-23  
**Status**: Current implementation (v0.1.2)
