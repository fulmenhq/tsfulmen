import { describe, expect, it } from "vitest";
import { SimilarityError } from "../errors.js";

describe("SimilarityError", () => {
  it("should create error with message", () => {
    const error = new SimilarityError("Test error");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SimilarityError);
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("SimilarityError");
  });

  it("should include catalog property", () => {
    const error = new SimilarityError("Test error");

    expect(error.catalog).toBe("similarity");
  });

  it("should capture cause if provided", () => {
    const cause = new Error("Original error");
    const error = new SimilarityError("Wrapper error", cause);

    expect(error.cause).toBe(cause);
  });

  it("should have stack trace", () => {
    const error = new SimilarityError("Test error");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("SimilarityError");
  });
});
