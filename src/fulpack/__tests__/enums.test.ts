/**
 * Tests for Crucible-generated fulpack enums
 */

import { describe, expect, it } from "vitest";
import { ArchiveFormat, EntryType, Operation } from "../../crucible/fulpack/types.js";

describe("Fulpack Enums (Crucible-Generated)", () => {
  describe("ArchiveFormat", () => {
    it("should have correct values", () => {
      expect(ArchiveFormat.TAR).toBe("tar");
      expect(ArchiveFormat.TAR_GZ).toBe("tar.gz");
      expect(ArchiveFormat.ZIP).toBe("zip");
      expect(ArchiveFormat.GZIP).toBe("gzip");
    });

    it("should have four formats", () => {
      const formats = Object.values(ArchiveFormat);
      // TypeScript enums have both key and value entries
      // Filter to get only the string values
      const formatValues = formats.filter((v) => typeof v === "string");
      expect(formatValues).toHaveLength(4);
      expect(formatValues).toContain("tar");
      expect(formatValues).toContain("tar.gz");
      expect(formatValues).toContain("zip");
      expect(formatValues).toContain("gzip");
    });
  });

  describe("EntryType", () => {
    it("should have correct values", () => {
      expect(EntryType.FILE).toBe("file");
      expect(EntryType.DIRECTORY).toBe("directory");
      expect(EntryType.SYMLINK).toBe("symlink");
    });

    it("should have three entry types", () => {
      const types = Object.values(EntryType);
      const typeValues = types.filter((v) => typeof v === "string");
      expect(typeValues).toHaveLength(3);
      expect(typeValues).toContain("file");
      expect(typeValues).toContain("directory");
      expect(typeValues).toContain("symlink");
    });
  });

  describe("Operation", () => {
    it("should have correct values", () => {
      expect(Operation.CREATE).toBe("create");
      expect(Operation.EXTRACT).toBe("extract");
      expect(Operation.SCAN).toBe("scan");
      expect(Operation.VERIFY).toBe("verify");
      expect(Operation.INFO).toBe("info");
    });

    it("should have five operations", () => {
      const operations = Object.values(Operation);
      const operationValues = operations.filter((v) => typeof v === "string");
      expect(operationValues).toHaveLength(5);
      expect(operationValues).toContain("create");
      expect(operationValues).toContain("extract");
      expect(operationValues).toContain("scan");
      expect(operationValues).toContain("verify");
      expect(operationValues).toContain("info");
    });
  });

  // Note: ChecksumAlgorithm and OverwriteBehavior are not enums in Crucible v0.2.14
  // They are string union types in the CreateOptions and ExtractOptions interfaces
  // Example: checksum_algorithm?: "xxh3-128" | "sha256" | "sha512" | "sha1" | "md5"
  // Example: overwrite?: "error" | "skip" | "overwrite"
});
