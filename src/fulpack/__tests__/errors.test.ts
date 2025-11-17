/**
 * Tests for fulpack error handling
 */

import { describe, expect, it } from "vitest";
import { Operation } from "../../crucible/fulpack/types.js";
import {
  checkDecompressionBomb,
  createFulpackError,
  ERROR_CODES,
  FulpackOperationError,
  hasPathTraversal,
  isAbsolutePath,
  validatePath,
} from "../errors.js";

describe("Fulpack Error Handling", () => {
  describe("createFulpackError", () => {
    it("should create a basic error", () => {
      const error = createFulpackError("TEST_ERROR", "Test message", Operation.CREATE);

      expect(error.code).toBe("TEST_ERROR");
      expect(error.message).toBe("Test message");
      expect(error.operation).toBe(Operation.CREATE);
      expect(error.path).toBeUndefined();
      expect(error.archive).toBeUndefined();
      expect(error.details).toBeUndefined();
    });

    it("should create error with context", () => {
      const error = createFulpackError("TEST_ERROR", "Test message", Operation.EXTRACT, {
        path: "test/file.txt",
        archive: "test.tar.gz",
        details: { entry_index: 42 },
      });

      expect(error.code).toBe("TEST_ERROR");
      expect(error.message).toBe("Test message");
      expect(error.operation).toBe(Operation.EXTRACT);
      expect(error.path).toBe("test/file.txt");
      expect(error.archive).toBe("test.tar.gz");
      expect(error.details).toEqual({ entry_index: 42 });
    });
  });

  describe("FulpackOperationError", () => {
    it("should create error from canonical error", () => {
      const canonicalError = createFulpackError("TEST_ERROR", "Test message", Operation.SCAN, {
        path: "test.txt",
      });

      const operationError = new FulpackOperationError(canonicalError);

      expect(operationError.name).toBe("FulpackOperationError");
      expect(operationError.code).toBe("TEST_ERROR");
      expect(operationError.message).toBe("Test message");
      expect(operationError.operation).toBe(Operation.SCAN);
      expect(operationError.path).toBe("test.txt");
    });

    it("should convert back to canonical format", () => {
      const canonicalError = createFulpackError("TEST_ERROR", "Test message", Operation.VERIFY, {
        archive: "test.tar.gz",
      });

      const operationError = new FulpackOperationError(canonicalError);
      const converted = operationError.toCanonical();

      expect(converted).toEqual(canonicalError);
    });
  });

  describe("Security validation functions", () => {
    describe("hasPathTraversal", () => {
      it("should detect path traversal with ..", () => {
        expect(hasPathTraversal("../../../etc/passwd")).toBe(true);
        expect(hasPathTraversal("folder/../file")).toBe(true);
        expect(hasPathTraversal("normal/file.txt")).toBe(false);
      });

      it("should detect Windows path traversal", () => {
        expect(hasPathTraversal("..\\..\\windows\\system32")).toBe(true);
        expect(hasPathTraversal("folder\\..\\file")).toBe(true);
      });
    });

    describe("isAbsolutePath", () => {
      it("should detect Unix absolute paths", () => {
        expect(isAbsolutePath("/etc/passwd")).toBe(true);
        expect(isAbsolutePath("/usr/local/bin")).toBe(true);
        expect(isAbsolutePath("relative/path")).toBe(false);
      });

      it("should detect Windows absolute paths", () => {
        expect(isAbsolutePath("C:\\Windows\\System32")).toBe(true);
        expect(isAbsolutePath("D:\\data\\file.txt")).toBe(true);
        expect(isAbsolutePath("relative\\path")).toBe(false);
      });
    });

    describe("validatePath", () => {
      it("should allow relative paths", () => {
        const error = validatePath("relative/path.txt", Operation.SCAN);
        expect(error).toBeNull();
      });

      it("should reject absolute paths by default", () => {
        const error = validatePath("/absolute/path.txt", Operation.SCAN);
        expect(error).not.toBeNull();
        expect(error?.code).toBe(ERROR_CODES.ABSOLUTE_PATH);
        expect(error?.operation).toBe(Operation.SCAN);
      });

      it("should allow absolute paths when permitted", () => {
        const error = validatePath("/absolute/path.txt", Operation.SCAN, true);
        expect(error).toBeNull();
      });

      it("should reject path traversal", () => {
        const error = validatePath("../parent/file.txt", Operation.SCAN);
        expect(error).not.toBeNull();
        expect(error?.code).toBe(ERROR_CODES.PATH_TRAVERSAL);
        expect(error?.operation).toBe(Operation.SCAN);
      });
    });

    describe("checkDecompressionBomb", () => {
      it("should pass normal compression ratios", () => {
        const error = checkDecompressionBomb(
          1024 * 1024, // 1MB uncompressed
          512 * 1024, // 512KB compressed
          1024 * 1024 * 1024, // 1GB max size
          100000, // 100k max entries
          1, // 1 entry
        );
        expect(error).toBeNull();
      });

      it("should reject oversized archives", () => {
        const error = checkDecompressionBomb(
          2 * 1024 * 1024 * 1024, // 2GB uncompressed
          1024 * 1024, // 1MB compressed
          1024 * 1024 * 1024, // 1GB max size
          100000, // 100k max entries
          1, // 1 entry
        );
        expect(error).not.toBeNull();
        expect(error?.code).toBe(ERROR_CODES.DECOMPRESSION_BOMB);
        expect(error?.details?.actual_size).toBe(2 * 1024 * 1024 * 1024);
        expect(error?.details?.max_size).toBe(1024 * 1024 * 1024);
      });

      it("should reject too many entries", () => {
        const error = checkDecompressionBomb(
          1024 * 1024, // 1MB uncompressed
          512 * 1024, // 512KB compressed
          1024 * 1024 * 1024, // 1GB max size
          100000, // 100k max entries
          200000, // 200k entries
        );
        expect(error).not.toBeNull();
        expect(error?.code).toBe(ERROR_CODES.DECOMPRESSION_BOMB);
      });

      it("should reject suspicious compression ratios", () => {
        const error = checkDecompressionBomb(
          100 * 1024 * 1024, // 100MB uncompressed
          1024, // 1KB compressed (100:1 ratio)
          1024 * 1024 * 1024, // 1GB max size
          100000, // 100k max entries
          1, // 1 entry
        );
        expect(error).not.toBeNull();
        expect(error?.code).toBe(ERROR_CODES.DECOMPRESSION_BOMB);
        expect(error?.details?.compression_ratio).toBe(100 * 1024);
      });
    });
  });

  describe("ERROR_CODES", () => {
    it("should contain all required error codes", () => {
      expect(ERROR_CODES.INVALID_ARCHIVE_FORMAT).toBe("INVALID_ARCHIVE_FORMAT");
      expect(ERROR_CODES.INVALID_PATH).toBe("INVALID_PATH");
      expect(ERROR_CODES.INVALID_OPTIONS).toBe("INVALID_OPTIONS");
      expect(ERROR_CODES.PATH_TRAVERSAL).toBe("PATH_TRAVERSAL");
      expect(ERROR_CODES.ABSOLUTE_PATH).toBe("ABSOLUTE_PATH");
      expect(ERROR_CODES.SYMLINK_ESCAPE).toBe("SYMLINK_ESCAPE");
      expect(ERROR_CODES.DECOMPRESSION_BOMB).toBe("DECOMPRESSION_BOMB");
      expect(ERROR_CODES.CHECKSUM_MISMATCH).toBe("CHECKSUM_MISMATCH");
      expect(ERROR_CODES.ARCHIVE_NOT_FOUND).toBe("ARCHIVE_NOT_FOUND");
      expect(ERROR_CODES.ARCHIVE_CORRUPT).toBe("ARCHIVE_CORRUPT");
      expect(ERROR_CODES.EXTRACTION_FAILED).toBe("EXTRACTION_FAILED");
      expect(ERROR_CODES.PERMISSION_DENIED).toBe("PERMISSION_DENIED");
      expect(ERROR_CODES.DISK_FULL).toBe("DISK_FULL");
    });
  });
});
