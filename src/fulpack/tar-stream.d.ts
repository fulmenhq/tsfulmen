declare module "tar-stream" {
  import { Readable, Writable } from "node:stream";

  export interface Pack {
    entry(entry: { name: string; mode?: number; mtime?: Date }, source?: Readable): Writable;
    finalize(): void;
  }

  export interface Extract {
    on(
      event: "entry",
      listener: (
        header: { name: string; mode?: number; mtime?: Date; size: number; type: string },
        stream: Readable,
        next: () => void,
      ) => void,
    ): void;
    on(event: "finish", listener: () => void): void;
    on(event: "error", listener: (error: Error) => void): void;
  }

  export function pack(): Pack;
  export function extract(): Extract;
}
