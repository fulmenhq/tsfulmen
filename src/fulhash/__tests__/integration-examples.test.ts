import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Algorithm } from "../../crucible/fulhash/types.js";
import { Digest } from "../digest.js";
import { hash, hashBytes, hashString } from "../hash.js";
import { createStreamHasher } from "../stream.js";

describe("Integration Examples", () => {
  describe("Block Hashing Examples", () => {
    it("should hash a string with default algorithm (XXH3-128)", async () => {
      const input = "Hello, FulmenHQ!";
      const digest = await hash(input);

      expect(digest.algorithm).toBe(Algorithm.XXH3_128);
      expect(digest.hex).toHaveLength(32);
      expect(digest.formatted).toMatch(/^xxh3-128:[0-9a-f]{32}$/);
    });

    it("should hash a string with SHA-256", async () => {
      const input = "Hello, FulmenHQ!";
      const digest = await hash(input, { algorithm: Algorithm.SHA256 });

      expect(digest.algorithm).toBe(Algorithm.SHA256);
      expect(digest.hex).toHaveLength(64);
      expect(digest.formatted).toMatch(/^sha256:[0-9a-f]{64}$/);
    });

    it("should hash binary data", async () => {
      const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      const digest = await hashBytes(data);

      expect(digest.algorithm).toBe(Algorithm.XXH3_128);
      expect(digest.bytes).toEqual(expect.any(Array));
    });

    it("should use convenience wrapper for strings", async () => {
      const input = "Quick hash example";
      const digest = await hashString(input);

      expect(digest.formatted).toMatch(/^xxh3-128:[0-9a-f]{32}$/);
    });
  });

  describe("Streaming API Examples", () => {
    it("should hash data incrementally with default algorithm", async () => {
      const hasher = await createStreamHasher();

      hasher.update("Part 1: ");
      hasher.update("Part 2: ");
      hasher.update("Part 3");

      const digest = hasher.digest();

      expect(digest.algorithm).toBe(Algorithm.XXH3_128);
      expect(digest.formatted).toMatch(/^xxh3-128:[0-9a-f]{32}$/);
    });

    it("should hash data incrementally with SHA-256", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });

      hasher.update("Streaming ");
      hasher.update("hash ");
      hasher.update("example");

      const digest = hasher.digest();

      expect(digest.algorithm).toBe(Algorithm.SHA256);
      expect(digest.hex).toHaveLength(64);
    });

    it("should reset and reuse hasher", async () => {
      const hasher = await createStreamHasher();

      hasher.update("First input");
      const firstDigest = hasher.digest();

      hasher.reset();
      hasher.update("Second input");
      const secondDigest = hasher.digest();

      expect(firstDigest.hex).not.toBe(secondDigest.hex);
      expect(firstDigest.algorithm).toBe(secondDigest.algorithm);
    });

    it("should support method chaining", async () => {
      const hasher = await createStreamHasher();

      const digest = hasher.update("Chain ").update("multiple ").update("updates").digest();

      expect(digest).toBeInstanceOf(Digest);
    });
  });

  describe("Checksum Parsing and Validation", () => {
    it("should parse and verify checksums", async () => {
      const input = "Verify this content";
      const digest = await hash(input);
      const checksum = digest.formatted;

      const parsed = Digest.parse(checksum);
      expect(parsed.algorithm).toBe(digest.algorithm);
      expect(parsed.hex).toBe(digest.hex);

      const isValid = await Digest.verify(input, checksum);
      expect(isValid).toBe(true);
    });

    it("should detect invalid checksums", async () => {
      const input = "Original content";
      const digest = await hash(input);
      const checksum = digest.formatted;

      const isValid = await Digest.verify("Modified content", checksum);
      expect(isValid).toBe(false);
    });

    it("should compare digests", async () => {
      const input = "Same input";
      const digest1 = await hash(input);
      const digest2 = await hash(input);
      const digest3 = await hash("Different input");

      expect(digest1.equals(digest2)).toBe(true);
      expect(digest1.equals(digest3)).toBe(false);
    });
  });

  describe("File Hashing Examples", () => {
    it("should hash a file using streaming API", async () => {
      const tmpFile = join(tmpdir(), `fulhash-test-${Date.now()}.txt`);
      const content = "File content to hash";

      await writeFile(tmpFile, content, "utf8");

      const fileData = await readFile(tmpFile);
      const hasher = await createStreamHasher();
      hasher.update(fileData);
      const digest = hasher.digest();

      expect(digest.formatted).toMatch(/^xxh3-128:[0-9a-f]{32}$/);

      const blockDigest = await hash(content);
      expect(digest.hex).toBe(blockDigest.hex);
    });

    it("should verify file integrity with checksum", async () => {
      const tmpFile = join(tmpdir(), `fulhash-verify-${Date.now()}.txt`);
      const content = "Verify file integrity";

      await writeFile(tmpFile, content, "utf8");

      const originalDigest = await hash(content);
      const checksum = originalDigest.formatted;

      const fileData = await readFile(tmpFile, "utf8");
      const isValid = await Digest.verify(fileData, checksum);

      expect(isValid).toBe(true);
    });
  });

  describe("Multi-File Manifest Example", () => {
    it("should generate checksums for multiple inputs", async () => {
      const files = [
        { name: "file1.txt", content: "Content of file 1" },
        { name: "file2.txt", content: "Content of file 2" },
        { name: "file3.txt", content: "Content of file 3" },
      ];

      const manifest = await Promise.all(
        files.map(async (file) => {
          const digest = await hash(file.content);
          return {
            name: file.name,
            checksum: digest.formatted,
            algorithm: digest.algorithm,
          };
        }),
      );

      expect(manifest).toHaveLength(3);
      expect(manifest[0]).toMatchObject({
        name: "file1.txt",
        checksum: expect.stringMatching(/^xxh3-128:[0-9a-f]{32}$/),
        algorithm: Algorithm.XXH3_128,
      });
    });

    it("should verify manifest checksums", async () => {
      const files = [
        { name: "config.json", content: '{"setting": "value"}' },
        { name: "data.txt", content: "Important data" },
      ];

      const manifest = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          content: file.content,
          checksum: (await hash(file.content)).formatted,
        })),
      );

      const verifications = await Promise.all(
        manifest.map(async (entry) => Digest.verify(entry.content, entry.checksum)),
      );

      expect(verifications).toEqual([true, true]);
    });
  });

  describe("Cross-Algorithm Comparison", () => {
    it("should compare performance characteristics", async () => {
      const input = "Test input for algorithm comparison";

      const xxh3Digest = await hash(input, { algorithm: Algorithm.XXH3_128 });
      const sha256Digest = await hash(input, { algorithm: Algorithm.SHA256 });

      expect(xxh3Digest.hex).toHaveLength(32);
      expect(sha256Digest.hex).toHaveLength(64);

      expect(xxh3Digest.algorithm).toBe(Algorithm.XXH3_128);
      expect(sha256Digest.algorithm).toBe(Algorithm.SHA256);
    });

    it("should demonstrate different algorithms for same input", async () => {
      const input = "Consistent input";

      const digest1 = await hash(input, { algorithm: Algorithm.XXH3_128 });
      const digest2 = await hash(input, { algorithm: Algorithm.XXH3_128 });
      const digest3 = await hash(input, { algorithm: Algorithm.SHA256 });

      expect(digest1.hex).toBe(digest2.hex);
      expect(digest1.hex).not.toBe(digest3.hex);
    });
  });
});
