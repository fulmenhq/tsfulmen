/**
 * Ambient type declarations for archiver v8.
 *
 * archiver 8.0.0 (2026-05-08) is a ground-up ESM rewrite that replaced the
 * callable `archiver(format, options)` factory with format-specific classes
 * (`ZipArchive`, `TarArchive`, `JsonArchive`) extending a shared `Archiver`
 * core (`Transform` stream). It ships no bundled types, and `@types/archiver`
 * (frozen at 7.x) still describes the removed factory API — so it is wrong for
 * v8, not merely missing.
 *
 * This local shim covers the v8 surface that fulpack consumes. Remove it (and
 * restore `@types/archiver`) once `@types/archiver@8` lands on DefinitelyTyped.
 *
 * Upstream: https://github.com/archiverjs/node-archiver (v8.0.0)
 */
declare module "archiver" {
  import { Transform } from "node:stream";

  /** Per-entry metadata accepted by `file()`/`directory()`/`append()`. */
  export interface EntryData {
    /** Entry name (path) within the archive. */
    name?: string;
    /** Entry permissions (octal). */
    mode?: number;
    /** Path prefix prepended to the entry name. */
    prefix?: string;
    /** Modification time for the entry. */
    date?: Date | string;
  }

  export interface CoreOptions {
    /** Stream highWaterMark. */
    highWaterMark?: number;
    /** Concurrency for the internal stat queue. */
    statConcurrency?: number;
  }

  export interface ZipOptions extends CoreOptions {
    zlib?: { level?: number };
    store?: boolean;
    comment?: string;
    forceLocalTime?: boolean;
    forceZip64?: boolean;
  }

  export interface TarOptions extends CoreOptions {
    gzip?: boolean;
    gzipOptions?: { level?: number };
  }

  /** Shared archive core; a `Transform` stream you pipe to a destination. */
  export class Archiver extends Transform {
    /** Append a file from the filesystem. */
    file(filepath: string, data: EntryData): this;
    /** Append a directory tree from the filesystem (`destpath: false` flattens). */
    directory(dirpath: string, destpath: string | false, data?: EntryData): this;
    /** Append arbitrary data (buffer, stream, or string). */
    append(source: Buffer | NodeJS.ReadableStream | string, data: EntryData): this;
    /** Append a symlink entry (does not touch the filesystem). */
    symlink(filepath: string, target: string, mode?: number): this;
    /** Finalize the archive; resolves once the output module has ended. */
    finalize(): Promise<void>;
    /** Total bytes processed so far. */
    pointer(): number;
    /** Abort the archive and underlying streams. */
    abort(): this;
  }

  export class ZipArchive extends Archiver {
    constructor(options?: ZipOptions);
  }

  export class TarArchive extends Archiver {
    constructor(options?: TarOptions);
  }

  export class JsonArchive extends Archiver {
    constructor(options?: CoreOptions);
  }
}
