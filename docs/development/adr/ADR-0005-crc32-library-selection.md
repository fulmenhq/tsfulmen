---
id: ADR-0005
title: "CRC32/CRC32C Library Selection for Fulhash"
scope: tsfulmen
status: accepted
date: 2025-11-22
deciders:
  - Module Weaver (@module-weaver)
consulted:
  - Fulmen Enterprise Architect (@fulmen-ea-steward)
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

Adopt **hybrid JS/WASM libraries** for CRC support in v0.1.14:

- Use `fast-crc32c` for CRC32C (includes optional WASM path, MIT licensed).
- Use `crc-32` for CRC32 (lightweight pure JS, MIT licensed).

Both dependencies are small, require no native build, and provide multi-GB/s throughput on modern runtimes—sufficient for Fulhash use cases (Pathfinder checksums, archive metadata, workhorse config tooling). We will:

- Mark them as regular dependencies (no native build chain required).
- Add performance tests to track throughput on synthetic fixtures (see plan extension below).
- Document the trade-offs (CRC not cryptographic, when to use vs sha256).

## Consequences

- Install remains hassle-free for Bun/Node consumers (no optional-native compile step).
- CRC performance is “good enough” for expected workloads; if we later need higher throughput across all hash algorithms, we can revisit a consolidated Fulmen WASM module (similar to `string-metrics-wasm`) containing xxh3/CRC/SHA kernels.
- Plan updated to include a performance benchmarking phase so we track CRC throughput/regression using script-generated fixtures instead of committing large sample files.

## Future Work

- Re-evaluate after rollout: if CRC usage patterns show the hybrid libs are too slow, we will design a Fulmen hashing WASM package that covers xxh3, crc variants, and potential future algorithms in one artifact (minimizing overhead). Document this revisit trigger in Fulhash plan and monitor benchmarks.
