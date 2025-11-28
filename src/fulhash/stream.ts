import { createHash } from "node:crypto";
import type { IHasher } from "hash-wasm";
import { Algorithm } from "../crucible/fulhash/types.js";
import * as crc32 from "./algorithms/crc32.js";
import * as crc32c from "./algorithms/crc32c.js";
import type { StreamHasher, StreamHasherOptions } from "./definitions.js";
import { Digest } from "./digest.js";
import { DigestStateError, UnsupportedAlgorithmError } from "./errors.js";
import { createHasher as createXXH3Hasher, initializeWasm } from "./wasm-loader.js";

enum State {
  INITIAL = "initial",
  UPDATING = "updating",
  FINALIZED = "finalized",
}

function intToBytes(crc: number): Uint8Array {
  const bytes = new Uint8Array(4);
  const unsigned = crc >>> 0;
  bytes[0] = (unsigned >>> 24) & 0xff;
  bytes[1] = (unsigned >>> 16) & 0xff;
  bytes[2] = (unsigned >>> 8) & 0xff;
  bytes[3] = unsigned & 0xff;
  return bytes;
}

// Helper to define local interface for CRC hashers returned by our modules
interface CRC32Hasher extends IHasher {
  // We only use the update method with Uint8Array in our wrapper,
  // but we declare it compatible with IHasher to avoid TS complaints if possible,
  // or cast it. hash-wasm's IHasher expects IDataType (string | Buffer | TypedArray).
  update(data: any): IHasher;
}

abstract class BaseStreamHasher implements StreamHasher {
  protected state: State = State.INITIAL;
  protected readonly algorithm: Algorithm;

  constructor(algorithm: Algorithm) {
    this.algorithm = algorithm;
  }

  abstract update(data: string | Uint8Array): StreamHasher;
  abstract digest(): Digest;
  abstract reset(): StreamHasher;

  protected ensureNotFinalized(): void {
    if (this.state === State.FINALIZED) {
      throw new DigestStateError("Cannot update after digest(). Call reset() to reuse hasher.");
    }
  }

  protected ensureUpdating(): void {
    if (this.state !== State.UPDATING && this.state !== State.INITIAL) {
      throw new DigestStateError("Invalid state for digest(). Hasher may have been finalized.");
    }
  }

  protected markUpdating(): void {
    this.state = State.UPDATING;
  }

  protected markFinalized(): void {
    this.state = State.FINALIZED;
  }

  protected markInitial(): void {
    this.state = State.INITIAL;
  }
}

class SHA256StreamHasher extends BaseStreamHasher {
  private hasher: ReturnType<typeof createHash>;

  constructor() {
    super(Algorithm.SHA256);
    this.hasher = createHash("sha256");
  }

  update(data: string | Uint8Array): StreamHasher {
    this.ensureNotFinalized();
    this.markUpdating();

    if (typeof data === "string") {
      this.hasher.update(data, "utf8");
    } else {
      this.hasher.update(data);
    }

    return this;
  }

  digest(): Digest {
    this.ensureUpdating();
    this.markFinalized();

    const bytes = new Uint8Array(this.hasher.digest());
    return new Digest(this.algorithm, bytes);
  }

  reset(): StreamHasher {
    this.hasher = createHash("sha256");
    this.markInitial();
    return this;
  }
}

class XXH3StreamHasher extends BaseStreamHasher {
  private hasher: IHasher;

  constructor(hasher: IHasher) {
    super(Algorithm.XXH3_128);
    this.hasher = hasher;
    this.hasher.init();
  }

  update(data: string | Uint8Array): StreamHasher {
    this.ensureNotFinalized();
    this.markUpdating();

    if (typeof data === "string") {
      const encoder = new TextEncoder();
      this.hasher.update(encoder.encode(data));
    } else {
      this.hasher.update(data);
    }

    return this;
  }

  digest(): Digest {
    this.ensureUpdating();
    this.markFinalized();

    const bytes = this.hasher.digest("binary");
    return new Digest(this.algorithm, bytes);
  }

  reset(): StreamHasher {
    this.hasher.init();
    this.markInitial();
    return this;
  }
}

class CRC32StreamHasher extends BaseStreamHasher {
  private hasher: CRC32Hasher | null = null;

  constructor() {
    super(Algorithm.CRC32);
  }

  async init(): Promise<void> {
    this.hasher = await crc32.createHasher();
    this.hasher.init();
  }

  update(data: string | Uint8Array): StreamHasher {
    this.ensureNotFinalized();
    this.markUpdating();

    if (!this.hasher) {
      // This shouldn't happen if createStreamHasher calls init, but technically
      // synchronous update() can't await. We might need to buffer or assume initialized.
      // However, the Factory createStreamHasher is async, so we can await init there.
      throw new Error("Hasher not initialized");
    }

    if (typeof data === "string") {
      const encoder = new TextEncoder();
      this.hasher.update(encoder.encode(data));
    } else {
      this.hasher.update(data);
    }
    return this;
  }

  digest(): Digest {
    this.ensureUpdating();
    this.markFinalized();
    if (!this.hasher) throw new Error("Hasher not initialized");

    const hex = this.hasher.digest();
    const bytes = intToBytes(parseInt(hex, 16));
    return new Digest(this.algorithm, bytes);
  }

  reset(): StreamHasher {
    if (!this.hasher) throw new Error("Hasher not initialized");
    this.hasher.init();
    this.markInitial();
    return this;
  }
}

class CRC32CStreamHasher extends BaseStreamHasher {
  private hasher: CRC32Hasher | null = null;

  constructor() {
    super(Algorithm.CRC32C);
  }

  async init(): Promise<void> {
    this.hasher = await crc32c.createHasher();
    this.hasher.init();
  }

  update(data: string | Uint8Array): StreamHasher {
    this.ensureNotFinalized();
    this.markUpdating();

    if (!this.hasher) throw new Error("Hasher not initialized");

    if (typeof data === "string") {
      const encoder = new TextEncoder();
      this.hasher.update(encoder.encode(data));
    } else {
      this.hasher.update(data);
    }
    return this;
  }

  digest(): Digest {
    this.ensureUpdating();
    this.markFinalized();
    if (!this.hasher) throw new Error("Hasher not initialized");

    const hex = this.hasher.digest();
    const bytes = intToBytes(parseInt(hex, 16));
    return new Digest(this.algorithm, bytes);
  }

  reset(): StreamHasher {
    if (!this.hasher) throw new Error("Hasher not initialized");
    this.hasher.init();
    this.markInitial();
    return this;
  }
}

export async function createStreamHasher(options: StreamHasherOptions = {}): Promise<StreamHasher> {
  const algorithm = options.algorithm ?? Algorithm.XXH3_128;

  switch (algorithm) {
    case Algorithm.SHA256:
      return new SHA256StreamHasher();
    case Algorithm.XXH3_128: {
      await initializeWasm();
      const wasmHasher = await createXXH3Hasher();
      return new XXH3StreamHasher(wasmHasher);
    }
    case Algorithm.CRC32: {
      const hasher = new CRC32StreamHasher();
      await hasher.init();
      return hasher;
    }
    case Algorithm.CRC32C: {
      const hasher = new CRC32CStreamHasher();
      await hasher.init();
      return hasher;
    }
    default:
      throw new UnsupportedAlgorithmError(algorithm, Object.values(Algorithm));
  }
}
