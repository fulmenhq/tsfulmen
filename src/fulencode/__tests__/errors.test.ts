import { describe, expect, it } from "vitest";
import { FulencodeError } from "../errors.js";

describe("FulencodeError", () => {
  it("creates error with minimal required properties", () => {
    const error = new FulencodeError({
      code: "TEST_ERROR",
      message: "Test error message",
      operation: "encode",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FulencodeError);
    expect(error.name).toBe("FulencodeError");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.message).toBe("Test error message");
    expect(error.operation).toBe("encode");
    expect(error.inputFormat).toBeUndefined();
    expect(error.outputFormat).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it("creates error with inputFormat for decode operations", () => {
    const error = new FulencodeError({
      code: "DECODE_FAILED",
      message: "Failed to decode",
      operation: "decode",
      inputFormat: "base64",
    });

    expect(error.operation).toBe("decode");
    expect(error.inputFormat).toBe("base64");
    expect(error.outputFormat).toBeUndefined();
  });

  it("creates error with outputFormat for encode operations", () => {
    const error = new FulencodeError({
      code: "ENCODE_FAILED",
      message: "Failed to encode",
      operation: "encode",
      outputFormat: "hex",
    });

    expect(error.operation).toBe("encode");
    expect(error.outputFormat).toBe("hex");
    expect(error.inputFormat).toBeUndefined();
  });

  it("creates error with details object", () => {
    const error = new FulencodeError({
      code: "INVALID_INPUT",
      message: "Invalid input at byte offset",
      operation: "decode",
      inputFormat: "utf-8",
      details: {
        byteOffset: 42,
        codepointOffset: 10,
        invalidBytes: [0xff, 0xfe],
        expected: "valid UTF-8",
        actual: "invalid sequence",
      },
    });

    expect(error.details).toBeDefined();
    expect(error.details?.byteOffset).toBe(42);
    expect(error.details?.codepointOffset).toBe(10);
    expect(error.details?.invalidBytes).toEqual([0xff, 0xfe]);
    expect(error.details?.expected).toBe("valid UTF-8");
    expect(error.details?.actual).toBe("invalid sequence");
  });

  it("creates error with cause for error chaining", () => {
    const originalError = new Error("Original error");
    const error = new FulencodeError({
      code: "WRAPPED_ERROR",
      message: "Wrapped error with cause",
      operation: "encode",
      cause: originalError,
    });

    expect((error as unknown as { cause: unknown }).cause).toBe(originalError);
  });

  it("creates error with all properties", () => {
    const cause = new TypeError("type mismatch");
    const error = new FulencodeError({
      code: "FULL_ERROR",
      message: "Complete error",
      operation: "normalize",
      inputFormat: "utf-16le",
      outputFormat: "utf-8",
      details: {
        detectedEncoding: "utf-16le",
        confidence: 0.95,
      },
      cause,
    });

    expect(error.code).toBe("FULL_ERROR");
    expect(error.message).toBe("Complete error");
    expect(error.operation).toBe("normalize");
    expect(error.inputFormat).toBe("utf-16le");
    expect(error.outputFormat).toBe("utf-8");
    expect(error.details?.detectedEncoding).toBe("utf-16le");
    expect(error.details?.confidence).toBe(0.95);
    expect((error as unknown as { cause: unknown }).cause).toBe(cause);
  });

  it("supports detect operation", () => {
    const error = new FulencodeError({
      code: "DETECT_FAILED",
      message: "Detection failed",
      operation: "detect",
    });

    expect(error.operation).toBe("detect");
  });

  it("supports bom operation", () => {
    const error = new FulencodeError({
      code: "BOM_ERROR",
      message: "BOM error",
      operation: "bom",
    });

    expect(error.operation).toBe("bom");
  });

  it("allows arbitrary keys in details", () => {
    const error = new FulencodeError({
      code: "CUSTOM_ERROR",
      message: "Error with custom details",
      operation: "encode",
      details: {
        customKey: "customValue",
        numericKey: 123,
        arrayKey: [1, 2, 3],
      },
    });

    expect(error.details?.customKey).toBe("customValue");
    expect(error.details?.numericKey).toBe(123);
    expect(error.details?.arrayKey).toEqual([1, 2, 3]);
  });
});
