/**
 * Tests for fulpack core operations
 */

import { createReadStream, createWriteStream, existsSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArchiveFormat } from "../../crucible/fulpack/types.js";
import { create, extract, info, scan, verify } from "../core.js";
import { FulpackOperationError } from "../errors.js";

describe("Fulpack Core Operations", () => {
  let tempDir: string;
  let testFile: string;
  let gzipFile: string;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = join(tmpdir(), `fulpack-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Create test file
    testFile = join(tempDir, "test.txt");
    await writeFile(testFile, "Hello, World! This is test content for compression.");

    // Create gzip version of test file
    gzipFile = join(tempDir, "test.txt.gz");
    const readStream = createReadStream(testFile);
    const writeStream = createWriteStream(gzipFile);
    const gzip = createGzip();
    await pipeline(readStream, gzip, writeStream);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("create", () => {
    it("should create ZIP archives successfully", async () => {
      const zipFile = join(tempDir, "output.zip");

      const result = await create(testFile, zipFile, ArchiveFormat.ZIP);

      expect(result.format).toBe(ArchiveFormat.ZIP);
      expect(result.compression).toBe("deflate");
      expect(result.entry_count).toBe(1);
      expect(result.total_size).toBeGreaterThan(0);
      expect(result.compressed_size).toBeGreaterThan(0);
      expect(existsSync(zipFile)).toBe(true);
    });

    it("should create TAR.GZ archives successfully", async () => {
      const tarGzFile = join(tempDir, "output.tar.gz");

      const result = await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      expect(result.format).toBe(ArchiveFormat.TAR_GZ);
      expect(result.compression).toBe("gzip");
      expect(result.entry_count).toBeGreaterThanOrEqual(1);
      expect(result.total_size).toBeGreaterThan(0);
      expect(result.compressed_size).toBeGreaterThan(0);
      // Small files may compress larger due to overhead - just verify ratio is calculated
      expect(result.compression_ratio).toBeGreaterThan(0);
      expect(existsSync(tarGzFile)).toBe(true);
    });

    it("should reject unsupported formats", async () => {
      await expect(create(testFile, "output.7z", "7z" as ArchiveFormat)).rejects.toThrow(
        FulpackOperationError,
      );
    });
  });

  describe("extract", () => {
    it("should reject non-existent archives", async () => {
      await expect(extract("non-existent.gz", tempDir)).rejects.toThrow(FulpackOperationError);
    });

    it("should extract gzip files successfully", async () => {
      const extractDir = join(tempDir, "extracted");
      await mkdir(extractDir, { recursive: true });

      const result = await extract(gzipFile, extractDir);

      expect(result.extracted_count).toBe(1);
      expect(result.skipped_count).toBe(0);
      expect(result.error_count).toBe(0);
      expect(result.errors).toHaveLength(0);

      const extractedFile = join(extractDir, "test.txt");
      expect(existsSync(extractedFile)).toBe(true);
    });

    it("should skip existing files when configured", async () => {
      const extractDir = join(tempDir, "extracted");
      await mkdir(extractDir, { recursive: true });

      // Create existing file
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Existing content");

      const result = await extract(gzipFile, extractDir, {
        overwrite: "skip",
      });

      expect(result.extracted_count).toBe(0);
      expect(result.skipped_count).toBe(1);
      expect(result.error_count).toBe(0);

      // File should still have original content
      const content = await readFile(existingFile, "utf-8");
      expect(content).toBe("Existing content");
    });

    it("should error on existing files when configured", async () => {
      const extractDir = join(tempDir, "extracted");
      await mkdir(extractDir, { recursive: true });

      // Create existing file
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Existing content");

      await expect(
        extract(gzipFile, extractDir, {
          overwrite: "error",
        }),
      ).rejects.toThrow(FulpackOperationError);
    });

    it("should extract tar.gz archives successfully", async () => {
      // First create a valid tar.gz archive
      const tarGzFile = join(tempDir, "test.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      // Extract to new directory
      const extractDir = join(tempDir, "extracted-tgz");
      await mkdir(extractDir, { recursive: true });

      const result = await extract(tarGzFile, extractDir);

      expect(result.extracted_count).toBeGreaterThanOrEqual(1);
      expect(result.error_count).toBe(0);
      expect(existsSync(join(extractDir, "test.txt"))).toBe(true);
    });
  });

  describe("scan", () => {
    it("should reject non-existent archives", async () => {
      await expect(scan("non-existent.gz")).rejects.toThrow(FulpackOperationError);
    });

    it("should scan gzip files successfully", async () => {
      const entries = await scan(gzipFile);

      expect(entries).toHaveLength(1);
      expect(entries[0].path).toBe("test.txt");
      expect(entries[0].type).toBe("file");
      expect(entries[0].size).toBe(0); // Not implemented for gzip
      expect(entries[0].compressed_size).toBeGreaterThan(0);
      expect(entries[0].modified).toBeDefined();
    });

    it("should include metadata when requested", async () => {
      const entries = await scan(gzipFile, {
        include_metadata: true,
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].mode).toBeDefined();
    });

    it("should reject tar.gz scanning (temporarily disabled)", async () => {
      const tarGzFile = join(tempDir, "test.tar.gz");
      await writeFile(tarGzFile, "fake tar.gz content");

      await expect(scan(tarGzFile)).rejects.toThrow(FulpackOperationError);
    });
  });

  describe("verify", () => {
    it("should reject non-existent archives", async () => {
      await expect(verify("non-existent.gz")).rejects.toThrow(FulpackOperationError);
    });

    it("should verify valid gzip files", async () => {
      const result = await verify(gzipFile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.entry_count).toBe(0);
      expect(result.checksums_verified).toBe(0);
      expect(result.checks_performed).toContain("structure_valid");
    });

    it("should detect empty files", async () => {
      const emptyFile = join(tempDir, "empty.gz");
      await writeFile(emptyFile, "");

      const result = await verify(emptyFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("ARCHIVE_CORRUPT");
    });
  });

  describe("info", () => {
    it("should reject non-existent archives", async () => {
      await expect(info("non-existent.gz")).rejects.toThrow(FulpackOperationError);
    });

    it("should detect gzip format", async () => {
      const archiveInfo = await info(gzipFile);

      expect(archiveInfo.format).toBe(ArchiveFormat.GZIP);
      expect(archiveInfo.compression).toBe("gzip");
      expect(archiveInfo.compressed_size).toBeGreaterThan(0);
      expect(archiveInfo.entry_count).toBe(0);
      expect(archiveInfo.has_checksums).toBe(false);
      expect(archiveInfo.created).toBeDefined();
    });

    it("should detect tar.gz format", async () => {
      const tarGzFile = join(tempDir, "test.tar.gz");
      await writeFile(tarGzFile, "fake content");

      const archiveInfo = await info(tarGzFile);

      expect(archiveInfo.format).toBe(ArchiveFormat.TAR_GZ);
      expect(archiveInfo.compression).toBe("gzip");
    });

    it("should detect zip format", async () => {
      const zipFile = join(tempDir, "test.zip");
      await writeFile(zipFile, "fake content");

      const archiveInfo = await info(zipFile);

      expect(archiveInfo.format).toBe(ArchiveFormat.ZIP);
      expect(archiveInfo.compression).toBe("deflate");
    });

    it("should reject unknown formats", async () => {
      const unknownFile = join(tempDir, "test.unknown");
      await writeFile(unknownFile, "fake content");

      await expect(info(unknownFile)).rejects.toThrow(FulpackOperationError);
    });
  });
});
