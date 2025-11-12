import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { hash, hashBytes, hashString } from "../hash.js";
import type { FixturesFile } from "../types.js";
import { Algorithm } from "../types.js";

const FIXTURES_PATH = join(process.cwd(), "config/crucible-ts/library/fulhash/fixtures.yaml");

describe("Block Hashing", () => {
  describe("hash() with string input", () => {
    it("should hash string using XXH3-128 by default", async () => {
      const result = await hash("test");

      expect(result.algorithm).toBe(Algorithm.XXH3_128);
      expect(result.hex).toBeTruthy();
      expect(result.hex.length).toBe(32);
      expect(result.formatted).toMatch(/^xxh3-128:[0-9a-f]{32}$/);
    });

    it("should hash empty string", async () => {
      const result = await hash("");

      expect(result.algorithm).toBe(Algorithm.XXH3_128);
      expect(result.hex).toBe("99aa06d3014798d86001c324468d497f");
      expect(result.formatted).toBe("xxh3-128:99aa06d3014798d86001c324468d497f");
    });

    it("should accept algorithm override", async () => {
      const result = await hash("test", { algorithm: Algorithm.SHA256 });

      expect(result.algorithm).toBe(Algorithm.SHA256);
    });

    it("should hash using SHA-256 via override", async () => {
      const result = await hash("test", { algorithm: Algorithm.SHA256 });

      expect(result.algorithm).toBe(Algorithm.SHA256);
      expect(result.hex).toBeTruthy();
      expect(result.hex.length).toBe(64);
      expect(result.formatted).toMatch(/^sha256:[0-9a-f]{64}$/);
    });
  });

  describe("hash() with Uint8Array input", () => {
    it("should hash byte array", async () => {
      const input = new Uint8Array([0x01, 0x02, 0x03]);
      const result = await hash(input);

      expect(result.algorithm).toBe(Algorithm.XXH3_128);
      expect(result.hex).toBeTruthy();
      expect(result.hex.length).toBe(32);
    });

    it("should hash empty byte array", async () => {
      const input = new Uint8Array([]);
      const result = await hash(input);

      expect(result.hex).toBe("99aa06d3014798d86001c324468d497f");
    });
  });

  describe("hashString() convenience wrapper", () => {
    it("should hash string", async () => {
      const result = await hashString("Hello, World!");

      expect(result.algorithm).toBe(Algorithm.XXH3_128);
      expect(result.hex).toBe("531df2844447dd5077db03842cd75395");
    });

    it("should accept options", async () => {
      const result = await hashString("test", { algorithm: Algorithm.SHA256 });

      expect(result.algorithm).toBe(Algorithm.SHA256);
    });
  });

  describe("hashBytes() convenience wrapper", () => {
    it("should hash bytes", async () => {
      const input = new TextEncoder().encode("Hello, World!");
      const result = await hashBytes(input);

      expect(result.algorithm).toBe(Algorithm.XXH3_128);
      expect(result.hex).toBe("531df2844447dd5077db03842cd75395");
    });

    it("should accept options", async () => {
      const input = new Uint8Array([0x01]);
      const result = await hashBytes(input, { algorithm: Algorithm.SHA256 });

      expect(result.algorithm).toBe(Algorithm.SHA256);
    });
  });

  describe("Fixture Validation", () => {
    const content = readFileSync(FIXTURES_PATH, "utf-8");
    const fixtures: FixturesFile = parse(content);

    it("should match empty-input fixture", async () => {
      const fixture = fixtures.fixtures.find((f) => f.name === "empty-input");
      expect(fixture).toBeDefined();
      if (!fixture || typeof fixture.input !== "string") {
        throw new Error("Fixture missing required string input");
      }

      const result = await hash(fixture.input);
      expect(result.formatted).toBe(fixture.xxh3_128);
    });

    it("should match hello-world fixture", async () => {
      const fixture = fixtures.fixtures.find((f) => f.name === "hello-world");
      expect(fixture).toBeDefined();
      if (!fixture || typeof fixture.input !== "string") {
        throw new Error("Fixture missing required string input");
      }

      const result = await hash(fixture.input);
      expect(result.formatted).toBe(fixture.xxh3_128);
    });

    it("should match single-byte fixture", async () => {
      const fixture = fixtures.fixtures.find((f) => f.name === "single-byte");
      expect(fixture).toBeDefined();
      if (!fixture || typeof fixture.input !== "string") {
        throw new Error("Fixture missing required string input");
      }

      const result = await hash(fixture.input);
      expect(result.formatted).toBe(fixture.xxh3_128);
    });

    it("should match unicode-emoji fixture", async () => {
      const fixture = fixtures.fixtures.find((f) => f.name === "unicode-emoji");
      expect(fixture).toBeDefined();
      if (!fixture || typeof fixture.input !== "string") {
        throw new Error("Fixture missing required string input");
      }

      const result = await hash(fixture.input);
      expect(result.formatted).toBe(fixture.xxh3_128);
    });

    it("should match lorem-ipsum fixture", async () => {
      const fixture = fixtures.fixtures.find((f) => f.name === "lorem-ipsum");
      expect(fixture).toBeDefined();
      if (!fixture || typeof fixture.input !== "string") {
        throw new Error("Fixture missing required string input");
      }

      const result = await hash(fixture.input);
      expect(result.formatted).toBe(fixture.xxh3_128);
    });

    it("should match binary-sequence fixture", async () => {
      const fixture = fixtures.fixtures.find((f) => f.name === "binary-sequence");
      expect(fixture).toBeDefined();

      if (!fixture || !Array.isArray(fixture.input_bytes)) {
        throw new Error("Fixture missing required byte input");
      }

      const input = new Uint8Array(fixture.input_bytes);
      const result = await hash(input);
      expect(result.formatted).toBe(fixture.xxh3_128);
    });
  });

  describe("XXH3-128 Algorithm", () => {
    it("should hash string with XXH3-128", async () => {
      const result = await hash("test data", { algorithm: Algorithm.XXH3_128 });

      expect(result.algorithm).toBe(Algorithm.XXH3_128);
      expect(result.hex).toBe("f012c3aaa2168e2f884ceb29fc98cdfd");
      expect(result.hex.length).toBe(32);
      expect(result.bytes.length).toBe(16);
      expect(result.formatted).toBe("xxh3-128:f012c3aaa2168e2f884ceb29fc98cdfd");
    });

    it("should hash empty string with XXH3-128", async () => {
      const result = await hash("", { algorithm: Algorithm.XXH3_128 });

      expect(result.algorithm).toBe(Algorithm.XXH3_128);
      expect(result.hex.length).toBe(32);
      expect(result.bytes.length).toBe(16);
    });

    it("should hash bytes with XXH3-128", async () => {
      const input = new TextEncoder().encode("test data");
      const result = await hashBytes(input, { algorithm: Algorithm.XXH3_128 });

      expect(result.algorithm).toBe(Algorithm.XXH3_128);
      expect(result.hex).toBe("f012c3aaa2168e2f884ceb29fc98cdfd");
    });

    it("should produce consistent hashes", async () => {
      const result1 = await hash("Hello, World!", {
        algorithm: Algorithm.XXH3_128,
      });
      const result2 = await hash("Hello, World!", {
        algorithm: Algorithm.XXH3_128,
      });

      expect(result1.hex).toBe(result2.hex);
      expect(result1.formatted).toBe(result2.formatted);
    });

    it("should produce different hashes for different inputs", async () => {
      const result1 = await hash("test1", { algorithm: Algorithm.XXH3_128 });
      const result2 = await hash("test2", { algorithm: Algorithm.XXH3_128 });

      expect(result1.hex).not.toBe(result2.hex);
    });
  });
});
