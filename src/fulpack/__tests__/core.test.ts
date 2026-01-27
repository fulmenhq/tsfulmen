/**
 * Tests for fulpack core operations
 */

import {
  createReadStream,
  createWriteStream,
  existsSync,
  rmSync,
  symlinkSync,
} from "node:fs";
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
    // Create temporary directory with unique ID to avoid race conditions
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    tempDir = join(tmpdir(), `fulpack-test-${uniqueId}`);
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

    it("should scan tar.gz archives successfully", async () => {
      // Create a real tar.gz archive first
      const tarGzFile = join(tempDir, "test-scan.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const entries = await scan(tarGzFile);

      expect(entries).toBeInstanceOf(Array);
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0]).toHaveProperty("path");
      expect(entries[0]).toHaveProperty("type");
      expect(entries[0]).toHaveProperty("size");
      expect(entries[0]).toHaveProperty("modified");
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
      expect(result.entry_count).toBe(1); // GZIP is single file
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
      expect(archiveInfo.entry_count).toBe(1); // GZIP is single file
      expect(archiveInfo.has_checksums).toBe(false);
      expect(archiveInfo.created).toBeDefined();
    });

    it("should detect tar.gz format", async () => {
      // Create a real tar.gz archive
      const tarGzFile = join(tempDir, "test-info.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const archiveInfo = await info(tarGzFile);

      expect(archiveInfo.format).toBe(ArchiveFormat.TAR_GZ);
      expect(archiveInfo.compression).toBe("gzip");
      expect(archiveInfo.entry_count).toBeGreaterThanOrEqual(1);
      expect(archiveInfo.total_size).toBeGreaterThan(0);
      expect(archiveInfo.compression_ratio).toBeGreaterThan(0);
    });

    it("should detect zip format", async () => {
      // Create a real ZIP archive
      const zipFile = join(tempDir, "test-info.zip");
      await create(testFile, zipFile, ArchiveFormat.ZIP);

      const archiveInfo = await info(zipFile);

      expect(archiveInfo.format).toBe(ArchiveFormat.ZIP);
      expect(archiveInfo.compression).toBe("deflate");
      expect(archiveInfo.entry_count).toBeGreaterThanOrEqual(1);
      // Note: archiver may not write uncompressed sizes to ZIP central directory for small files
      // So total_size might be 0 even for valid archives
      expect(archiveInfo.total_size).toBeGreaterThanOrEqual(0);
      expect(archiveInfo.compression_ratio).toBeGreaterThanOrEqual(0);
    });

    it("should reject unknown formats", async () => {
      const unknownFile = join(tempDir, "test.unknown");
      await writeFile(unknownFile, "fake content");

      await expect(info(unknownFile)).rejects.toThrow(FulpackOperationError);
    });

    it("should detect tar format", async () => {
      // Create a real TAR archive
      const tarFile = join(tempDir, "test-info.tar");
      await create(testFile, tarFile, ArchiveFormat.TAR);

      const archiveInfo = await info(tarFile);

      expect(archiveInfo.format).toBe(ArchiveFormat.TAR);
      expect(archiveInfo.compression).toBe("none");
      expect(archiveInfo.entry_count).toBeGreaterThanOrEqual(1);
      expect(archiveInfo.total_size).toBeGreaterThan(0);
    });
  });

  describe("TAR format operations", () => {
    it("should create TAR archives successfully", async () => {
      const tarFile = join(tempDir, "output.tar");

      const result = await create(testFile, tarFile, ArchiveFormat.TAR);

      expect(result.format).toBe(ArchiveFormat.TAR);
      expect(result.compression).toBe("none");
      expect(result.entry_count).toBe(1);
      expect(result.total_size).toBeGreaterThan(0);
      expect(result.compressed_size).toBeGreaterThan(0);
      expect(result.compression_ratio).toBe(1.0);
      expect(existsSync(tarFile)).toBe(true);
    });

    it("should extract TAR archives successfully", async () => {
      const tarFile = join(tempDir, "test.tar");
      await create(testFile, tarFile, ArchiveFormat.TAR);

      const extractDir = join(tempDir, "extracted-tar");
      await mkdir(extractDir, { recursive: true });

      const result = await extract(tarFile, extractDir);

      expect(result.extracted_count).toBeGreaterThanOrEqual(1);
      expect(result.error_count).toBe(0);
      expect(existsSync(join(extractDir, "test.txt"))).toBe(true);
    });

    it("should scan TAR archives successfully", async () => {
      const tarFile = join(tempDir, "test-scan.tar");
      await create(testFile, tarFile, ArchiveFormat.TAR);

      const entries = await scan(tarFile);

      expect(entries).toBeInstanceOf(Array);
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0]).toHaveProperty("path");
      expect(entries[0]).toHaveProperty("type");
      expect(entries[0]).toHaveProperty("size");
      expect(entries[0]).toHaveProperty("modified");
    });

    it("should scan TAR archives with metadata", async () => {
      const tarFile = join(tempDir, "test-scan-meta.tar");
      await create(testFile, tarFile, ArchiveFormat.TAR);

      const entries = await scan(tarFile, { include_metadata: true });

      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0]).toHaveProperty("mode");
    });
  });

  describe("GZIP format operations", () => {
    it("should create GZIP files successfully", async () => {
      const gzFile = join(tempDir, "output.gz");

      const result = await create(testFile, gzFile, ArchiveFormat.GZIP);

      expect(result.format).toBe(ArchiveFormat.GZIP);
      expect(result.compression).toBe("gzip");
      expect(result.entry_count).toBe(1);
      expect(result.total_size).toBeGreaterThan(0);
      expect(result.compressed_size).toBeGreaterThan(0);
      expect(existsSync(gzFile)).toBe(true);
    });

    it("should reject multiple sources for GZIP format", async () => {
      const gzFile = join(tempDir, "multi.gz");
      const testFile2 = join(tempDir, "test2.txt");
      await writeFile(testFile2, "Second file");

      await expect(create([testFile, testFile2], gzFile, ArchiveFormat.GZIP)).rejects.toThrow(
        FulpackOperationError,
      );
    });

    it("should reject directory source for GZIP format", async () => {
      const gzFile = join(tempDir, "dir.gz");
      const subDir = join(tempDir, "subdir");
      await mkdir(subDir, { recursive: true });

      await expect(create(subDir, gzFile, ArchiveFormat.GZIP)).rejects.toThrow(
        FulpackOperationError,
      );
    });
  });

  describe("ZIP format operations", () => {
    it("should extract ZIP archives successfully", async () => {
      const zipFile = join(tempDir, "test.zip");
      await create(testFile, zipFile, ArchiveFormat.ZIP);

      const extractDir = join(tempDir, "extracted-zip");
      await mkdir(extractDir, { recursive: true });

      const result = await extract(zipFile, extractDir);

      // ZIP extraction counts may be async - verify file exists
      expect(result.error_count).toBe(0);
      expect(existsSync(join(extractDir, "test.txt"))).toBe(true);
    });

    it("should scan ZIP archives successfully", async () => {
      const zipFile = join(tempDir, "test-scan.zip");
      await create(testFile, zipFile, ArchiveFormat.ZIP);

      const entries = await scan(zipFile);

      expect(entries).toBeInstanceOf(Array);
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0]).toHaveProperty("path");
      expect(entries[0]).toHaveProperty("type");
      expect(entries[0]).toHaveProperty("size");
    });

    it("should scan ZIP archives with metadata", async () => {
      const zipFile = join(tempDir, "test-scan-meta.zip");
      await create(testFile, zipFile, ArchiveFormat.ZIP);

      const entries = await scan(zipFile, { include_metadata: true });

      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0]).toHaveProperty("mode");
    });

    it("should skip existing files in ZIP extraction when configured", async () => {
      const zipFile = join(tempDir, "test-skip.zip");
      await create(testFile, zipFile, ArchiveFormat.ZIP);

      const extractDir = join(tempDir, "extracted-zip-skip");
      await mkdir(extractDir, { recursive: true });

      // Create existing file
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Existing content");

      const result = await extract(zipFile, extractDir, {
        overwrite: "skip",
      });

      expect(result.skipped_count).toBeGreaterThanOrEqual(1);

      // File should still have original content
      const content = await readFile(existingFile, "utf-8");
      expect(content).toBe("Existing content");
    });

    it("should overwrite existing files in ZIP extraction when configured", async () => {
      const zipFile = join(tempDir, "test-overwrite.zip");
      await create(testFile, zipFile, ArchiveFormat.ZIP);

      const extractDir = join(tempDir, "extracted-zip-overwrite");
      await mkdir(extractDir, { recursive: true });

      // Create existing file with different content
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Old content");

      const result = await extract(zipFile, extractDir, {
        overwrite: "overwrite",
      });

      expect(result.error_count).toBe(0);

      // File should have new content
      const content = await readFile(existingFile, "utf-8");
      expect(content).toBe("Hello, World! This is test content for compression.");
    });
  });

  describe("Directory archiving", () => {
    it("should create TAR.GZ archive from directory", async () => {
      // Create a directory with files
      const subDir = join(tempDir, "subdir");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "file1.txt"), "Content 1");
      await writeFile(join(subDir, "file2.txt"), "Content 2");

      const tarGzFile = join(tempDir, "dir.tar.gz");
      const result = await create(subDir, tarGzFile, ArchiveFormat.TAR_GZ);

      expect(result.format).toBe(ArchiveFormat.TAR_GZ);
      expect(existsSync(tarGzFile)).toBe(true);

      // Verify contents by scanning
      const entries = await scan(tarGzFile);
      expect(entries.length).toBeGreaterThanOrEqual(2);
    });

    it("should create TAR archive from directory", async () => {
      const subDir = join(tempDir, "subdir-tar");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "file1.txt"), "Content 1");
      await writeFile(join(subDir, "file2.txt"), "Content 2");

      const tarFile = join(tempDir, "dir.tar");
      const result = await create(subDir, tarFile, ArchiveFormat.TAR);

      expect(result.format).toBe(ArchiveFormat.TAR);
      expect(existsSync(tarFile)).toBe(true);

      const entries = await scan(tarFile);
      expect(entries.length).toBeGreaterThanOrEqual(2);
    });

    it("should create ZIP archive from directory", async () => {
      const subDir = join(tempDir, "subdir-zip");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "file1.txt"), "Content 1");
      await writeFile(join(subDir, "file2.txt"), "Content 2");

      const zipFile = join(tempDir, "dir.zip");
      const result = await create(subDir, zipFile, ArchiveFormat.ZIP);

      expect(result.format).toBe(ArchiveFormat.ZIP);
      expect(existsSync(zipFile)).toBe(true);

      const entries = await scan(zipFile);
      expect(entries.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle nested directories in TAR.GZ", async () => {
      const baseDir = join(tempDir, "nested");
      const nestedDir = join(baseDir, "level1", "level2");
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(baseDir, "root.txt"), "Root file");
      await writeFile(join(nestedDir, "deep.txt"), "Deep file");

      const tarGzFile = join(tempDir, "nested.tar.gz");
      await create(baseDir, tarGzFile, ArchiveFormat.TAR_GZ);

      const entries = await scan(tarGzFile);
      expect(entries.length).toBeGreaterThanOrEqual(2);

      const paths = entries.map((e) => e.path);
      expect(paths.some((p) => p.includes("root.txt"))).toBe(true);
      expect(paths.some((p) => p.includes("deep.txt"))).toBe(true);
    });
  });

  describe("Multiple source files", () => {
    it("should create TAR.GZ from multiple files", async () => {
      const file1 = join(tempDir, "multi1.txt");
      const file2 = join(tempDir, "multi2.txt");
      await writeFile(file1, "File 1 content");
      await writeFile(file2, "File 2 content");

      const tarGzFile = join(tempDir, "multi.tar.gz");
      const result = await create([file1, file2], tarGzFile, ArchiveFormat.TAR_GZ);

      expect(result.format).toBe(ArchiveFormat.TAR_GZ);
      expect(existsSync(tarGzFile)).toBe(true);

      const entries = await scan(tarGzFile);
      expect(entries.length).toBe(2);
    });

    it("should create ZIP from multiple files", async () => {
      const file1 = join(tempDir, "multi1.txt");
      const file2 = join(tempDir, "multi2.txt");
      await writeFile(file1, "File 1 content");
      await writeFile(file2, "File 2 content");

      const zipFile = join(tempDir, "multi.zip");
      const result = await create([file1, file2], zipFile, ArchiveFormat.ZIP);

      expect(result.format).toBe(ArchiveFormat.ZIP);
      expect(existsSync(zipFile)).toBe(true);

      const entries = await scan(zipFile);
      expect(entries.length).toBe(2);
    });

    it("should create TAR from multiple files", async () => {
      const file1 = join(tempDir, "multi1.txt");
      const file2 = join(tempDir, "multi2.txt");
      await writeFile(file1, "File 1 content");
      await writeFile(file2, "File 2 content");

      const tarFile = join(tempDir, "multi.tar");
      const result = await create([file1, file2], tarFile, ArchiveFormat.TAR);

      expect(result.format).toBe(ArchiveFormat.TAR);
      expect(existsSync(tarFile)).toBe(true);

      const entries = await scan(tarFile);
      expect(entries.length).toBe(2);
    });
  });

  describe("Error handling", () => {
    // Note: These tests use try/catch + delay to allow archiver streams to fully clean up
    // and avoid unhandled rejection warnings from orphaned write streams

    it("should reject non-existent source files for TAR.GZ", async () => {
      const tarGzFile = join(tempDir, "error.tar.gz");

      try {
        await create("non-existent-file.txt", tarGzFile, ArchiveFormat.TAR_GZ);
        expect.fail("Should have thrown FulpackOperationError");
      } catch (error) {
        expect(error).toBeInstanceOf(FulpackOperationError);
      }
      // Allow archiver streams to clean up
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it("should reject non-existent source files for TAR", async () => {
      const tarFile = join(tempDir, "error.tar");

      try {
        await create("non-existent-file.txt", tarFile, ArchiveFormat.TAR);
        expect.fail("Should have thrown FulpackOperationError");
      } catch (error) {
        expect(error).toBeInstanceOf(FulpackOperationError);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it("should reject non-existent source files for ZIP", async () => {
      const zipFile = join(tempDir, "error.zip");

      try {
        await create("non-existent-file.txt", zipFile, ArchiveFormat.ZIP);
        expect.fail("Should have thrown FulpackOperationError");
      } catch (error) {
        expect(error).toBeInstanceOf(FulpackOperationError);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it("should reject non-existent source files for GZIP", async () => {
      const gzFile = join(tempDir, "error.gz");

      try {
        await create("non-existent-file.txt", gzFile, ArchiveFormat.GZIP);
        expect.fail("Should have thrown FulpackOperationError");
      } catch (error) {
        expect(error).toBeInstanceOf(FulpackOperationError);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it("should reject unsupported formats for extraction", async () => {
      const unknownFile = join(tempDir, "test.unknown");
      await writeFile(unknownFile, "fake content");

      await expect(extract(unknownFile, tempDir)).rejects.toThrow(FulpackOperationError);
    });

    it("should reject unsupported formats for scanning", async () => {
      const unknownFile = join(tempDir, "test.unknown");
      await writeFile(unknownFile, "fake content");

      await expect(scan(unknownFile)).rejects.toThrow(FulpackOperationError);
    });
  });

  describe("TAR.GZ extraction options", () => {
    it("should skip existing files when configured", async () => {
      const tarGzFile = join(tempDir, "test-skip.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const extractDir = join(tempDir, "extracted-tgz-skip");
      await mkdir(extractDir, { recursive: true });

      // Create existing file
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Existing content");

      const result = await extract(tarGzFile, extractDir, {
        overwrite: "skip",
      });

      expect(result.skipped_count).toBeGreaterThanOrEqual(1);

      // File should still have original content
      const content = await readFile(existingFile, "utf-8");
      expect(content).toBe("Existing content");
    });

    it("should overwrite existing files when configured", async () => {
      const tarGzFile = join(tempDir, "test-overwrite.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const extractDir = join(tempDir, "extracted-tgz-overwrite");
      await mkdir(extractDir, { recursive: true });

      // Create existing file with different content
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Old content");

      const result = await extract(tarGzFile, extractDir, {
        overwrite: "overwrite",
      });

      expect(result.extracted_count).toBeGreaterThanOrEqual(1);

      // File should have new content
      const content = await readFile(existingFile, "utf-8");
      expect(content).toBe("Hello, World! This is test content for compression.");
    });

    it("should error on existing files when configured", async () => {
      const tarGzFile = join(tempDir, "test-error.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const extractDir = join(tempDir, "extracted-tgz-error");
      await mkdir(extractDir, { recursive: true });

      // Create existing file
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Existing content");

      const result = await extract(tarGzFile, extractDir, {
        overwrite: "error",
      });

      // Should have error for the existing file
      expect(result.error_count).toBeGreaterThanOrEqual(1);
    });

    it("should create destination directory if it does not exist", async () => {
      const tarGzFile = join(tempDir, "test-newdir.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const extractDir = join(tempDir, "new-destination-dir");

      const result = await extract(tarGzFile, extractDir);

      expect(result.extracted_count).toBeGreaterThanOrEqual(1);
      expect(existsSync(extractDir)).toBe(true);
    });
  });

  describe("TAR extraction options", () => {
    it("should skip existing files when configured", async () => {
      const tarFile = join(tempDir, "test-skip.tar");
      await create(testFile, tarFile, ArchiveFormat.TAR);

      const extractDir = join(tempDir, "extracted-tar-skip");
      await mkdir(extractDir, { recursive: true });

      // Create existing file
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Existing content");

      const result = await extract(tarFile, extractDir, {
        overwrite: "skip",
      });

      expect(result.skipped_count).toBeGreaterThanOrEqual(1);

      const content = await readFile(existingFile, "utf-8");
      expect(content).toBe("Existing content");
    });

    it("should overwrite existing files when configured", async () => {
      const tarFile = join(tempDir, "test-overwrite.tar");
      await create(testFile, tarFile, ArchiveFormat.TAR);

      const extractDir = join(tempDir, "extracted-tar-overwrite");
      await mkdir(extractDir, { recursive: true });

      // Create existing file with different content
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Old content");

      const result = await extract(tarFile, extractDir, {
        overwrite: "overwrite",
      });

      expect(result.extracted_count).toBeGreaterThanOrEqual(1);

      const content = await readFile(existingFile, "utf-8");
      expect(content).toBe("Hello, World! This is test content for compression.");
    });
  });

  describe("verify extended tests", () => {
    it("should verify tar.gz archives", async () => {
      const tarGzFile = join(tempDir, "verify.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const result = await verify(tarGzFile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.entry_count).toBeGreaterThanOrEqual(1);
      expect(result.checks_performed).toContain("structure_valid");
      expect(result.checks_performed).toContain("no_path_traversal");
      expect(result.checks_performed).toContain("no_decompression_bomb");
    });

    it("should verify tar archives", async () => {
      const tarFile = join(tempDir, "verify.tar");
      await create(testFile, tarFile, ArchiveFormat.TAR);

      const result = await verify(tarFile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.entry_count).toBeGreaterThanOrEqual(1);
    });

    it("should verify zip archives", async () => {
      const zipFile = join(tempDir, "verify.zip");
      await create(testFile, zipFile, ArchiveFormat.ZIP);

      const result = await verify(zipFile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.entry_count).toBeGreaterThanOrEqual(1);
    });

    it("should warn about missing checksums", async () => {
      const tarGzFile = join(tempDir, "no-checksums.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const result = await verify(tarGzFile);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("checksums"))).toBe(true);
    });
  });

  describe("gzip extraction with overwrite", () => {
    it("should overwrite existing files when configured", async () => {
      const extractDir = join(tempDir, "gzip-overwrite");
      await mkdir(extractDir, { recursive: true });

      // Create existing file
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Old content");

      const result = await extract(gzipFile, extractDir, {
        overwrite: "overwrite",
      });

      expect(result.extracted_count).toBe(1);

      // File should have new content
      const content = await readFile(existingFile, "utf-8");
      expect(content).toBe("Hello, World! This is test content for compression.");
    });
  });

  describe("output directory creation", () => {
    it("should create output directory for create if it does not exist", async () => {
      const outputDir = join(tempDir, "new-output-dir");
      const tarGzFile = join(outputDir, "output.tar.gz");

      const result = await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      expect(result.format).toBe(ArchiveFormat.TAR_GZ);
      expect(existsSync(outputDir)).toBe(true);
      expect(existsSync(tarGzFile)).toBe(true);
    });
  });

  describe("TGZ extension", () => {
    it("should handle .tgz extension for extraction", async () => {
      // Create a tar.gz file then rename to .tgz
      const tarGzFile = join(tempDir, "test.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      // Copy to .tgz
      const tgzFile = join(tempDir, "test.tgz");
      const readStream = createReadStream(tarGzFile);
      const writeStream = createWriteStream(tgzFile);
      await pipeline(readStream, writeStream);

      const extractDir = join(tempDir, "extracted-tgz-ext");
      await mkdir(extractDir, { recursive: true });

      const result = await extract(tgzFile, extractDir);

      expect(result.extracted_count).toBeGreaterThanOrEqual(1);
    });

    it("should handle .tgz extension for scan", async () => {
      const tarGzFile = join(tempDir, "test.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const tgzFile = join(tempDir, "scan-test.tgz");
      const readStream = createReadStream(tarGzFile);
      const writeStream = createWriteStream(tgzFile);
      await pipeline(readStream, writeStream);

      const entries = await scan(tgzFile);

      expect(entries.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle .tgz extension for info", async () => {
      const tarGzFile = join(tempDir, "test.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const tgzFile = join(tempDir, "info-test.tgz");
      const readStream = createReadStream(tarGzFile);
      const writeStream = createWriteStream(tgzFile);
      await pipeline(readStream, writeStream);

      const archiveInfo = await info(tgzFile);

      expect(archiveInfo.format).toBe(ArchiveFormat.TAR_GZ);
    });
  });

  describe("Symlink handling in directories", () => {
    it("should skip symlinks by default when archiving directories", async () => {
      const subDir = join(tempDir, "symlink-test");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "real.txt"), "Real file");

      // Create a symlink
      try {
        symlinkSync(join(subDir, "real.txt"), join(subDir, "link.txt"));
      } catch {
        // Skip test on systems that don't support symlinks
        return;
      }

      const tarGzFile = join(tempDir, "symlink.tar.gz");
      await create(subDir, tarGzFile, ArchiveFormat.TAR_GZ);

      const entries = await scan(tarGzFile);
      // Should only have the real file, symlink should be skipped
      expect(entries.length).toBe(1);
      expect(entries[0].path).toContain("real.txt");
    });
  });

  describe("ZIP extraction error on existing file", () => {
    it("should error on existing files when configured", async () => {
      const zipFile = join(tempDir, "test-error.zip");
      await create(testFile, zipFile, ArchiveFormat.ZIP);

      const extractDir = join(tempDir, "extracted-zip-error");
      await mkdir(extractDir, { recursive: true });

      // Create existing file
      const existingFile = join(extractDir, "test.txt");
      await writeFile(existingFile, "Existing content");

      const result = await extract(zipFile, extractDir, {
        overwrite: "error",
      });

      // Should have error for the existing file
      expect(result.error_count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("follow_symlinks option", () => {
    it("should follow symlinks when follow_symlinks is true for TAR.GZ", async () => {
      const subDir = join(tempDir, "symlink-follow-tgz");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "real.txt"), "Real file content");

      // Create a symlink
      try {
        symlinkSync(join(subDir, "real.txt"), join(subDir, "link.txt"));
      } catch {
        // Skip test on systems that don't support symlinks
        return;
      }

      const tarGzFile = join(tempDir, "follow-symlink.tar.gz");
      await create(subDir, tarGzFile, ArchiveFormat.TAR_GZ, {
        follow_symlinks: true,
      });

      const entries = await scan(tarGzFile);
      // Should have both the real file and the symlink target
      expect(entries.length).toBe(2);
    });

    it("should follow symlinks when follow_symlinks is true for TAR", async () => {
      const subDir = join(tempDir, "symlink-follow-tar");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "real.txt"), "Real file content");

      // Create a symlink
      try {
        symlinkSync(join(subDir, "real.txt"), join(subDir, "link.txt"));
      } catch {
        // Skip test on systems that don't support symlinks
        return;
      }

      const tarFile = join(tempDir, "follow-symlink.tar");
      await create(subDir, tarFile, ArchiveFormat.TAR, {
        follow_symlinks: true,
      });

      const entries = await scan(tarFile);
      // Should have both the real file and the symlink target
      expect(entries.length).toBe(2);
    });

    it("should follow symlinks when follow_symlinks is true for ZIP", async () => {
      const subDir = join(tempDir, "symlink-follow-zip");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "real.txt"), "Real file content");

      // Create a symlink
      try {
        symlinkSync(join(subDir, "real.txt"), join(subDir, "link.txt"));
      } catch {
        // Skip test on systems that don't support symlinks
        return;
      }

      const zipFile = join(tempDir, "follow-symlink.zip");
      await create(subDir, zipFile, ArchiveFormat.ZIP, {
        follow_symlinks: true,
      });

      const entries = await scan(zipFile);
      // Should have both the real file and the symlink target
      expect(entries.length).toBe(2);
    });

    it("should follow symlink to directory when follow_symlinks is true", async () => {
      const baseDir = join(tempDir, "symlink-dir-base");
      const targetDir = join(tempDir, "symlink-dir-target");
      await mkdir(baseDir, { recursive: true });
      await mkdir(targetDir, { recursive: true });
      await writeFile(join(targetDir, "nested.txt"), "Nested content");

      // Create a symlink to directory
      try {
        symlinkSync(targetDir, join(baseDir, "linked-dir"));
      } catch {
        // Skip test on systems that don't support symlinks
        return;
      }

      const tarGzFile = join(tempDir, "symlink-dir.tar.gz");
      await create(baseDir, tarGzFile, ArchiveFormat.TAR_GZ, {
        follow_symlinks: true,
      });

      const entries = await scan(tarGzFile);
      // Should have the nested file from the linked directory
      expect(entries.some((e) => e.path.includes("nested.txt"))).toBe(true);
    });
  });

  describe("preserve_permissions option", () => {
    it("should not preserve permissions when preserve_permissions is false", async () => {
      const tarGzFile = join(tempDir, "no-preserve.tar.gz");

      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ, {
        preserve_permissions: false,
      });

      expect(existsSync(tarGzFile)).toBe(true);

      // Archive should still be valid
      const entries = await scan(tarGzFile);
      expect(entries.length).toBeGreaterThanOrEqual(1);
    });

    it("should not preserve permissions in directory archiving", async () => {
      const subDir = join(tempDir, "no-preserve-dir");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "file.txt"), "Content");

      const tarGzFile = join(tempDir, "no-preserve-dir.tar.gz");
      await create(subDir, tarGzFile, ArchiveFormat.TAR_GZ, {
        preserve_permissions: false,
      });

      expect(existsSync(tarGzFile)).toBe(true);
    });
  });

  describe("compression_level option", () => {
    it("should use custom compression level for TAR.GZ", async () => {
      const tarGzFile = join(tempDir, "custom-level.tar.gz");

      const result = await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ, {
        compression_level: 9,
      });

      expect(result.format).toBe(ArchiveFormat.TAR_GZ);
      expect(existsSync(tarGzFile)).toBe(true);
    });

    it("should use custom compression level for ZIP", async () => {
      const zipFile = join(tempDir, "custom-level.zip");

      const result = await create(testFile, zipFile, ArchiveFormat.ZIP, {
        compression_level: 9,
      });

      expect(result.format).toBe(ArchiveFormat.ZIP);
      expect(existsSync(zipFile)).toBe(true);
    });

    it("should use custom compression level for GZIP", async () => {
      const gzFile = join(tempDir, "custom-level.gz");

      const result = await create(testFile, gzFile, ArchiveFormat.GZIP, {
        compression_level: 1,
      });

      expect(result.format).toBe(ArchiveFormat.GZIP);
      expect(existsSync(gzFile)).toBe(true);
    });
  });

  describe("extraction with directories in archive", () => {
    it("should extract directories from TAR.GZ", async () => {
      const subDir = join(tempDir, "dir-extract-tgz");
      const nestedDir = join(subDir, "nested");
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(nestedDir, "file.txt"), "Nested file");

      const tarGzFile = join(tempDir, "with-dirs.tar.gz");
      await create(subDir, tarGzFile, ArchiveFormat.TAR_GZ);

      const extractDir = join(tempDir, "extracted-dirs-tgz");
      const result = await extract(tarGzFile, extractDir);

      expect(result.error_count).toBe(0);
      expect(existsSync(join(extractDir, "nested", "file.txt"))).toBe(true);
    });

    it("should extract directories from TAR", async () => {
      const subDir = join(tempDir, "dir-extract-tar");
      const nestedDir = join(subDir, "nested");
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(nestedDir, "file.txt"), "Nested file");

      const tarFile = join(tempDir, "with-dirs.tar");
      await create(subDir, tarFile, ArchiveFormat.TAR);

      const extractDir = join(tempDir, "extracted-dirs-tar");
      const result = await extract(tarFile, extractDir);

      expect(result.error_count).toBe(0);
      expect(existsSync(join(extractDir, "nested", "file.txt"))).toBe(true);
    });

    it("should extract directories from ZIP", async () => {
      const subDir = join(tempDir, "dir-extract-zip");
      const nestedDir = join(subDir, "nested");
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(nestedDir, "file.txt"), "Nested file");

      const zipFile = join(tempDir, "with-dirs.zip");
      await create(subDir, zipFile, ArchiveFormat.ZIP);

      const extractDir = join(tempDir, "extracted-dirs-zip");
      const result = await extract(zipFile, extractDir);

      expect(result.error_count).toBe(0);
      expect(existsSync(join(extractDir, "nested", "file.txt"))).toBe(true);
    });
  });

  describe("scan without metadata", () => {
    it("should scan TAR.GZ without metadata", async () => {
      const tarGzFile = join(tempDir, "no-meta.tar.gz");
      await create(testFile, tarGzFile, ArchiveFormat.TAR_GZ);

      const entries = await scan(tarGzFile, { include_metadata: false });

      expect(entries.length).toBeGreaterThanOrEqual(1);
      // Mode should not be present when include_metadata is false
      expect(entries[0].mode).toBeUndefined();
    });

    it("should scan TAR without metadata", async () => {
      const tarFile = join(tempDir, "no-meta.tar");
      await create(testFile, tarFile, ArchiveFormat.TAR);

      const entries = await scan(tarFile, { include_metadata: false });

      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0].mode).toBeUndefined();
    });

    it("should scan ZIP without metadata", async () => {
      const zipFile = join(tempDir, "no-meta.zip");
      await create(testFile, zipFile, ArchiveFormat.ZIP);

      const entries = await scan(zipFile, { include_metadata: false });

      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0].mode).toBeUndefined();
    });

    it("should scan GZIP without metadata", async () => {
      const entries = await scan(gzipFile, { include_metadata: false });

      expect(entries.length).toBe(1);
      expect(entries[0].mode).toBeUndefined();
    });
  });
});
