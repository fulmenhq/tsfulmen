/**
 * Tests for fulpack enums
 */

import { describe, expect, it } from "vitest";
import {
  ArchiveFormat,
  ChecksumAlgorithm,
  EntryType,
  Operation,
  OverwriteBehavior,
} from "../enums.js";

describe("Fulpack Enums", () => {
  describe("ArchiveFormat", () => {
    it("should have correct values", () => {
      expect(ArchiveFormat.TAR_GZ).toBe("tar.gz");
      expect(ArchiveFormat.ZIP).toBe("zip");
      expect(ArchiveFormat.GZIP).toBe("gzip");
    });

    it("should have three formats", () => {
      const formats = Object.values(ArchiveFormat);
      expect(formats).toHaveLength(3);
      expect(formats).toContain("tar.gz");
      expect(formats).toContain("zip");
      expect(formats).toContain("gzip");
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
      expect(types).toHaveLength(3);
      expect(types).toContain("file");
      expect(types).toContain("directory");
      expect(types).toContain("symlink");
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
      expect(operations).toHaveLength(5);
      expect(operations).toContain("create");
      expect(operations).toContain("extract");
      expect(operations).toContain("scan");
      expect(operations).toContain("verify");
      expect(operations).toContain("info");
    });
  });

  describe("ChecksumAlgorithm", () => {
    it("should have correct values", () => {
      expect(ChecksumAlgorithm.SHA256).toBe("sha256");
      expect(ChecksumAlgorithm.SHA512).toBe("sha512");
      expect(ChecksumAlgorithm.SHA1).toBe("sha1");
      expect(ChecksumAlgorithm.MD5).toBe("md5");
    });

    it("should have four algorithms", () => {
      const algorithms = Object.values(ChecksumAlgorithm);
      expect(algorithms).toHaveLength(4);
      expect(algorithms).toContain("sha256");
      expect(algorithms).toContain("sha512");
      expect(algorithms).toContain("sha1");
      expect(algorithms).toContain("md5");
    });
  });

  describe("OverwriteBehavior", () => {
    it("should have correct values", () => {
      expect(OverwriteBehavior.ERROR).toBe("error");
      expect(OverwriteBehavior.SKIP).toBe("skip");
      expect(OverwriteBehavior.OVERWRITE).toBe("overwrite");
    });

    it("should have three behaviors", () => {
      const behaviors = Object.values(OverwriteBehavior);
      expect(behaviors).toHaveLength(3);
      expect(behaviors).toContain("error");
      expect(behaviors).toContain("skip");
      expect(behaviors).toContain("overwrite");
    });
  });
});
