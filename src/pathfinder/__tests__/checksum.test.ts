import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { hashString } from "../../fulhash/hash.js";
import { Algorithm } from "../../fulhash/types.js";
import { calculateChecksum, calculateChecksumsBatch } from "../checksum.js";
import { ChecksumAlgorithm } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHECKSUM_FIXTURE = path.join(__dirname, "fixtures", "checksum");
const ALPHA_PATH = path.join(CHECKSUM_FIXTURE, "alpha.txt");
const BETA_PATH = path.join(CHECKSUM_FIXTURE, "beta.txt");

describe("Pathfinder checksum utilities", () => {
  it("should calculate xxh3-128 checksum for files", async () => {
    const expected = await hashString(await fs.readFile(ALPHA_PATH, "utf-8"), {
      algorithm: Algorithm.XXH3_128,
    });
    const metadata = await calculateChecksum(ALPHA_PATH, ChecksumAlgorithm.XXH3_128);

    expect(metadata.checksum).toBe(`${ChecksumAlgorithm.XXH3_128}:${expected.hex}`);
    expect(metadata.checksumAlgorithm).toBe(ChecksumAlgorithm.XXH3_128);
    expect(metadata.checksumError).toBeUndefined();
  });

  it("should calculate sha256 checksum for files", async () => {
    const expected = await hashString(await fs.readFile(BETA_PATH, "utf-8"), {
      algorithm: Algorithm.SHA256,
    });
    const metadata = await calculateChecksum(BETA_PATH, ChecksumAlgorithm.SHA256);

    expect(metadata.checksum).toBe(`${ChecksumAlgorithm.SHA256}:${expected.hex}`);
    expect(metadata.checksumAlgorithm).toBe(ChecksumAlgorithm.SHA256);
  });

  it("should capture errors when checksum calculation fails", async () => {
    const metadata = await calculateChecksum(CHECKSUM_FIXTURE, ChecksumAlgorithm.XXH3_128);

    expect(metadata.checksum).toBeUndefined();
    expect(metadata.checksumAlgorithm).toBe(ChecksumAlgorithm.XXH3_128);
    expect(metadata.checksumError).toBeDefined();
  });

  it("should batch process checksums with concurrency", async () => {
    const files = [ALPHA_PATH, BETA_PATH];
    const results = await calculateChecksumsBatch(files, ChecksumAlgorithm.XXH3_128, 2);

    expect(results.size).toBe(2);
    for (const filePath of files) {
      const entry = results.get(filePath);
      expect(entry?.checksum).toMatch(/^xxh3-128:[a-f0-9]+$/);
    }
  });
});
