/**
 * Error classes for FulHash module
 */

export class FulHashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FulHashError';
    Object.setPrototypeOf(this, FulHashError.prototype);
  }
}

export class UnsupportedAlgorithmError extends FulHashError {
  constructor(algorithm: string, supportedAlgorithms: string[]) {
    super(
      `Unsupported algorithm "${algorithm}". Supported algorithms: ${supportedAlgorithms.join(', ')}`,
    );
    this.name = 'UnsupportedAlgorithmError';
    Object.setPrototypeOf(this, UnsupportedAlgorithmError.prototype);
  }
}

export class InvalidChecksumError extends FulHashError {
  constructor(checksum: string, reason: string) {
    super(`Invalid checksum "${checksum}": ${reason}. Expected format: algorithm:hex`);
    this.name = 'InvalidChecksumError';
    Object.setPrototypeOf(this, InvalidChecksumError.prototype);
  }
}

export class InvalidChecksumFormatError extends InvalidChecksumError {
  constructor(checksum: string, reason: string) {
    super(checksum, reason);
    this.name = 'InvalidChecksumFormatError';
    Object.setPrototypeOf(this, InvalidChecksumFormatError.prototype);
  }
}

export class DigestStateError extends FulHashError {
  constructor(operation: string) {
    super(`Cannot ${operation}: digest already finalized. Call reset() to reuse hasher.`);
    this.name = 'DigestStateError';
    Object.setPrototypeOf(this, DigestStateError.prototype);
  }
}
