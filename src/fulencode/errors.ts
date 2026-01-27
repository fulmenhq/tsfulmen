import type { EncodingFormat } from "./types.js";

export type FulencodeOperation = "encode" | "decode" | "detect" | "normalize" | "bom";

export interface FulencodeErrorDetails {
  byteOffset?: number;
  codepointOffset?: number;
  detectedEncoding?: string;
  confidence?: number;
  invalidBytes?: number[];
  expected?: string;
  actual?: string;
  [key: string]: unknown;
}

export class FulencodeError extends Error {
  public readonly code: string;
  public readonly operation: FulencodeOperation;
  public readonly inputFormat?: EncodingFormat;
  public readonly outputFormat?: EncodingFormat;
  public readonly details?: FulencodeErrorDetails;

  public constructor(args: {
    code: string;
    message: string;
    operation: FulencodeOperation;
    inputFormat?: EncodingFormat;
    outputFormat?: EncodingFormat;
    details?: FulencodeErrorDetails;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = "FulencodeError";
    this.code = args.code;
    this.operation = args.operation;
    this.inputFormat = args.inputFormat;
    this.outputFormat = args.outputFormat;
    this.details = args.details;
    if (args.cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = args.cause;
    }
  }
}
