/**
 * Tests for path safety and constraint enforcement utilities
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createConstraintViolationError,
  enforcePathConstraints,
  isPathWithinRoot,
  toPosixPath,
} from "../safety.js";
import { FulmenError } from "../../errors/index.js";
import { PathfinderErrorCode } from "../errors.js";

describe("Safety utilities", () => {
  describe("toPosixPath", () => {
    it("should convert platform path to posix format", () => {
      // Use path.sep to create a platform-specific path
      const platformPath = ["src", "components", "Button.tsx"].join(path.sep);
      const posixPath = toPosixPath(platformPath);
      expect(posixPath).toBe("src/components/Button.tsx");
    });

    it("should handle empty string", () => {
      expect(toPosixPath("")).toBe("");
    });

    it("should handle single segment", () => {
      expect(toPosixPath("file.txt")).toBe("file.txt");
    });
  });

  describe("isPathWithinRoot", () => {
    it("should return true for path within root", () => {
      expect(isPathWithinRoot("/workspace/project/src/index.ts", "/workspace/project")).toBe(true);
    });

    it("should return true for path equal to root", () => {
      expect(isPathWithinRoot("/workspace/project", "/workspace/project")).toBe(true);
    });

    it("should return false for path outside root", () => {
      expect(isPathWithinRoot("/other/path", "/workspace/project")).toBe(false);
    });

    it("should return false for path that escapes via ..", () => {
      expect(isPathWithinRoot("/workspace/project/../other", "/workspace/project")).toBe(false);
    });

    it("should handle relative paths by resolving them", () => {
      const result = isPathWithinRoot("./src/index.ts", process.cwd());
      expect(result).toBe(true);
    });
  });

  describe("enforcePathConstraints", () => {
    it("should allow path when no constraint is provided", () => {
      const result = enforcePathConstraints("/any/path", "path", undefined);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should allow path when constraint has no root", () => {
      const result = enforcePathConstraints("/any/path", "path", {});
      expect(result.allowed).toBe(true);
    });

    it("should allow path within constraint root", () => {
      const result = enforcePathConstraints("/workspace/project/src/index.ts", "src/index.ts", {
        root: "/workspace/project",
      });
      expect(result.allowed).toBe(true);
    });

    it("should reject path outside constraint root", () => {
      const result = enforcePathConstraints("/other/path/file.ts", "file.ts", {
        root: "/workspace/project",
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("escapes constraint root");
    });

    it("should handle constraint root that needs normalization", () => {
      const result = enforcePathConstraints("/workspace/project/src/file.ts", "src/file.ts", {
        root: "/workspace/./project",
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("createConstraintViolationError", () => {
    it("should create a FulmenError with correct code", () => {
      const error = createConstraintViolationError("Path escapes root boundary");

      expect(error).toBeInstanceOf(FulmenError);
      expect((error as FulmenError).data.code).toBe(PathfinderErrorCode.CONSTRAINT_VIOLATION);
    });

    it("should include reason as message", () => {
      const reason = "Path /external/file escapes root /workspace";
      const error = createConstraintViolationError(reason);

      expect((error as FulmenError).data.message).toBe(reason);
    });

    it("should have critical severity", () => {
      const error = createConstraintViolationError("Test violation");
      expect((error as FulmenError).data.severity).toBe("critical");
    });

    it("should include provided context", () => {
      const context = {
        path: "/external/file.ts",
        constraintRoot: "/workspace",
      };
      const error = createConstraintViolationError("Test violation", context);

      expect((error as FulmenError).data.context?.path).toBe("/external/file.ts");
      expect((error as FulmenError).data.context?.constraintRoot).toBe("/workspace");
    });

    it("should create error without context", () => {
      const error = createConstraintViolationError("Simple violation");
      expect(error).toBeInstanceOf(FulmenError);
    });
  });
});
