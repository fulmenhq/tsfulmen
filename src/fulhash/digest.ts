/**
 * Digest implementation - immutable hash result container
 */

import { Algorithm, type Digest as DigestInterface } from "../crucible/fulhash/types.js";
import {
  InvalidChecksumError,
  InvalidChecksumFormatError,
  UnsupportedAlgorithmError,
} from "./errors.js";

export class Digest implements DigestInterface {
  readonly algorithm: Algorithm;
  private readonly _bytes: Uint8Array;
  readonly hex: string;
  readonly formatted: string;

  constructor(algorithm: Algorithm, bytes: Uint8Array) {
    this.algorithm = algorithm;
    this._bytes = new Uint8Array(bytes);
    this.hex = Array.from(this._bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    this.formatted = `${this.algorithm}:${this.hex}`;
    Object.freeze(this);
  }

  get bytes(): number[] {
    return Array.from(this._bytes);
  }

  toJSON(): object {
    return {
      algorithm: this.algorithm,
      hex: this.hex,
      formatted: this.formatted,
    };
  }

  toString(): string {
    return this.formatted;
  }

  static parse(formatted: string): Digest {
    if (!formatted.includes(":")) {
      throw new InvalidChecksumFormatError(formatted, "missing separator");
    }

    const [algorithmStr, hex] = formatted.split(":", 2);

    if (!algorithmStr || !hex) {
      throw new InvalidChecksumFormatError(formatted, "invalid format");
    }

    const algorithm = algorithmStr as Algorithm;
    if (!Object.values(Algorithm).includes(algorithm)) {
      throw new UnsupportedAlgorithmError(algorithm, Object.values(Algorithm));
    }

    if (!/^[0-9a-f]+$/.test(hex)) {
      throw new InvalidChecksumError(
        formatted,
        "hex must contain only lowercase hexadecimal characters",
      );
    }

    const expectedLength = algorithm === Algorithm.XXH3_128 ? 32 : 64;
    if (hex.length !== expectedLength) {
      throw new InvalidChecksumError(
        formatted,
        `invalid hex length for ${algorithm}: expected ${expectedLength}, got ${hex.length}`,
      );
    }

    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
    }

    return new Digest(algorithm, bytes);
  }

  equals(other: Digest): boolean {
    if (this.algorithm !== other.algorithm) {
      return false;
    }
    if (this.hex !== other.hex) {
      return false;
    }
    return true;
  }

  static async verify(data: string | Uint8Array, checksum: string): Promise<boolean> {
    const expected = Digest.parse(checksum);
    const { hash } = await import("./hash.js");
    const actual = await hash(data, { algorithm: expected.algorithm });
    return actual.equals(expected);
  }
}
