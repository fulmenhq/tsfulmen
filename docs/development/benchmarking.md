# FulHash Benchmarking Guide

## Overview

We benchmark hashing performance to ensure:

1.  **Regression Safety**: Performance remains stable across releases.
2.  **Algorithm Comparison**: Understanding the relative speed of XXH3 vs SHA-256 vs CRC.
3.  **Optimization**: Tuning block sizes and buffer handling.

## Running Benchmarks

We use a standalone script to generate synthetic workloads and measure throughput without bloating the repository with large test files.

```bash
# Run the benchmark script
bun run scripts/perf/fulhash-crc-benchmark.ts
```

## Methodology

- **Synthetic Data**: Generates random buffers (1MB to 100MB) in memory.
- **Metrics**: Measures execution time and calculates throughput in MB/s.
- **Scenarios**:
  - Block hashing (single algorithm).
  - Multi-algorithm hashing (overhead check).

## Output Location

Benchmark results are printed to stdout. If configured, detailed logs may be written to `logs/benchmarks/` (which is gitignored).

## Adding New Benchmarks

Modify `scripts/perf/fulhash-crc-benchmark.ts` to add new scenarios. Ensure you use the `BenchmarkSuite` class to maintain consistent reporting.
