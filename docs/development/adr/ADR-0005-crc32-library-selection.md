---
id: ADR-0005
title: "CRC32/CRC32C Library Selection for Fulhash"
scope: tsfulmen
status: accepted
date: 2025-11-22
deciders:
  - devlead
consulted:
  - entarch
  - Forge Workhorse Tuvan team
---

## Context

Crucible v0.2.20 extends the Fulhash specification with CRC32 and CRC32C alongside xxh3-128 and SHA-256, plus `multiHash` and `verify` helpers. TSFulmen must add CRC support to stay compliant and unblock forge templates (Tuvan relies on CRC for archive workflows and legacy compatibility).

We evaluated three implementation paths:

1. **Node-native bindings** (e.g., `@node-rs/crc32` / `crc32c`): fastest but introduce native build requirements and add cross-platform install risk for Bun/Node users.
2. **Pure JS/WASM hybrids** (e.g., `fast-crc32c`, `crc-32`): solid throughput with zero native build; CRC32C version includes optional WASM acceleration.
3. **Custom WASM module** (similar to `@3leaps/string-metrics-wasm`): gives us control and potentially bundles multiple hash kernels, but adds build/maintenance overhead; best when we need a bespoke high-performance set across algorithms.

Given TSFulmen’s “no compile step” expectation and the existing precedent of using third-party WASM/JS modules when native performance is acceptable, we need a solution that balances install simplicity with adequate throughput.

## Decision

Adopt **hash-wasm** for all hashing algorithms (including CRC32/CRC32C) in v0.1.14:

- **Consolidation**: `hash-wasm` (already used for XXH3) supports CRC32 natively and CRC32C via custom polynomial (`0x82f63b78`).
- **Performance**: Provides WASM-accelerated throughput for all algorithms, outperforming pure JS implementations for large payloads.
- **Stability**: Avoids the segmentation faults observed with `fast-crc32c` native bindings in Bun/Vitest environments.
- **Simplicity**: Eliminates need for additional dependencies (`crc-32`, `fast-crc32c`).

We will:

- Remove `crc-32` and `fast-crc32c` dependencies.
- Update `src/fulhash` to use `hash-wasm` for CRC operations.
- Update documentation to reflect the unified WASM-based approach.

## Consequences

- **Unified Stack**: Single library for all hashing needs (XXH3, SHA, CRC).
- **Async API**: CRC operations will be Promise-based (consistent with XXH3), which may require `await` even for small inputs.
- **WASM Overhead**: Slight initialization cost, but amortized over operations (and already present for XXH3).
- **Reduced Bloat**: Fewer packages in `node_modules`.

## Future Work

- Monitor `hash-wasm` updates for explicit CRC32C exports (to avoid magic polynomial constants).
- Evaluate a custom consolidated WASM module only if `hash-wasm` throughput becomes a bottleneck (unlikely for current use cases).
