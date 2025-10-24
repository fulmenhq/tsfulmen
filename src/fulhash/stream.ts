import { createHash } from 'node:crypto';
import type { IHasher } from 'hash-wasm';
import { Digest } from './digest.js';
import { DigestStateError, UnsupportedAlgorithmError } from './errors.js';
import { Algorithm, type StreamHasher, type StreamHasherOptions } from './types.js';
import { createHasher as createXXH3Hasher, initializeWasm } from './wasm-loader.js';

enum State {
  INITIAL = 'initial',
  UPDATING = 'updating',
  FINALIZED = 'finalized',
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
      throw new DigestStateError('Cannot update after digest(). Call reset() to reuse hasher.');
    }
  }

  protected ensureUpdating(): void {
    if (this.state !== State.UPDATING && this.state !== State.INITIAL) {
      throw new DigestStateError('Invalid state for digest(). Hasher may have been finalized.');
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
    this.hasher = createHash('sha256');
  }

  update(data: string | Uint8Array): StreamHasher {
    this.ensureNotFinalized();
    this.markUpdating();

    if (typeof data === 'string') {
      this.hasher.update(data, 'utf8');
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
    this.hasher = createHash('sha256');
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

    if (typeof data === 'string') {
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

    const bytes = this.hasher.digest('binary');
    return new Digest(this.algorithm, bytes);
  }

  reset(): StreamHasher {
    this.hasher.init();
    this.markInitial();
    return this;
  }
}

export async function createStreamHasher(options: StreamHasherOptions = {}): Promise<StreamHasher> {
  const algorithm = options.algorithm ?? Algorithm.XXH3_128;

  if (algorithm === Algorithm.SHA256) {
    return new SHA256StreamHasher();
  }

  if (algorithm === Algorithm.XXH3_128) {
    await initializeWasm();
    const wasmHasher = await createXXH3Hasher();
    return new XXH3StreamHasher(wasmHasher);
  }

  throw new UnsupportedAlgorithmError(algorithm, [Algorithm.SHA256, Algorithm.XXH3_128]);
}
