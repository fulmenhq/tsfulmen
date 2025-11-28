import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Algorithm, multiHash } from "../../src/fulhash/index.js";

const LOG_DIR = "logs/benchmarks";

interface Result {
  name: string;
  sizeMB: number;
  timeMs: number;
  throughputMBps: number;
}

class BenchmarkSuite {
  private results: Result[] = [];

  async run(name: string, fn: () => Promise<void>, sizeBytes: number) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    const duration = end - start;
    const sizeMB = sizeBytes / (1024 * 1024);
    const throughput = sizeMB / (duration / 1000);

    const result = {
      name,
      sizeMB,
      timeMs: duration,
      throughputMBps: throughput,
    };
    this.results.push(result);

    console.log(
      `${name}: ${sizeMB.toFixed(2)} MB in ${duration.toFixed(2)}ms -> ${throughput.toFixed(
        2,
      )} MB/s`,
    );
  }

  async save() {
    await mkdir(LOG_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join(LOG_DIR, `fulhash-benchmark-${timestamp}.json`);
    await writeFile(file, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to ${file}`);
  }
}

async function main() {
  const suite = new BenchmarkSuite();
  const SIZE_10MB = 10 * 1024 * 1024;
  const SIZE_100MB = 100 * 1024 * 1024;

  // Generate data once
  console.log("Generating synthetic data...");
  const buffer10MB = new Uint8Array(SIZE_10MB);
  const buffer100MB = new Uint8Array(SIZE_100MB);
  crypto.getRandomValues(buffer10MB);
  // getRandomValues has a limit (65536 bytes), so we fill manually or use slice for simplicity in mock
  // For speed in this script, we'll just fill with a pattern or leave zeroed if strictly testing hash speed
  // (hash speed shouldn't depend on content entropy for these algos usually, but let's be safe)
  for (let i = 0; i < SIZE_10MB; i += 65536) {
    const chunk = buffer10MB.subarray(i, Math.min(i + 65536, SIZE_10MB));
    crypto.getRandomValues(chunk);
  }
  // Fill 100MB by repeating 10MB to save init time
  for (let i = 0; i < 10; i++) {
    buffer100MB.set(buffer10MB, i * SIZE_10MB);
  }

  console.log("\n--- Starting Benchmarks ---\n");

  await suite.run(
    "CRC32 (10MB)",
    async () => {
      await multiHash(buffer10MB, [Algorithm.CRC32]);
    },
    SIZE_10MB,
  );

  await suite.run(
    "CRC32C (10MB)",
    async () => {
      await multiHash(buffer10MB, [Algorithm.CRC32C]);
    },
    SIZE_10MB,
  );

  await suite.run(
    "XXH3-128 (10MB)",
    async () => {
      await multiHash(buffer10MB, [Algorithm.XXH3_128]);
    },
    SIZE_10MB,
  );

  await suite.run(
    "SHA-256 (10MB)",
    async () => {
      await multiHash(buffer10MB, [Algorithm.SHA256]);
    },
    SIZE_10MB,
  );

  await suite.run(
    "Combined (CRC32+SHA256) (10MB)",
    async () => {
      await multiHash(buffer10MB, [Algorithm.CRC32, Algorithm.SHA256]);
    },
    SIZE_10MB,
  );

  console.log("\n--- Large Payload (100MB) ---\n");

  await suite.run(
    "CRC32 (100MB)",
    async () => {
      await multiHash(buffer100MB, [Algorithm.CRC32]);
    },
    SIZE_100MB,
  );

  await suite.run(
    "XXH3-128 (100MB)",
    async () => {
      await multiHash(buffer100MB, [Algorithm.XXH3_128]);
    },
    SIZE_100MB,
  );

  await suite.save();
}

main().catch(console.error);
