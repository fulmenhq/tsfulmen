import { crc32, createCRC32 } from "hash-wasm";
import type { IHasher } from "hash-wasm";

// Local definition to avoid importing from hash-wasm/dist/lib/util which is not a public export
type IDataType =
  | string
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array
  | DataView
  | ArrayBuffer
  | SharedArrayBuffer;

/**
 * Convert hex string to Uint8Array
 * @internal
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    bytes[i] = Number.parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export async function hashBytes(data: Uint8Array): Promise<Uint8Array> {
  const hex = await crc32(data);
  return hexToBytes(hex);
}

export async function hashString(
  str: string,
  encoding: BufferEncoding = "utf8",
): Promise<Uint8Array> {
  if (encoding !== "utf8") {
    // hash-wasm only supports string input as UTF-8
    // For other encodings, convert to Buffer first
    const buf = Buffer.from(str, encoding);
    const hex = await crc32(buf);
    return hexToBytes(hex);
  }
  const hex = await crc32(str);
  return hexToBytes(hex);
}

// Ensure the hasher we return respects the IHasher interface correctly
interface CRC32Hasher extends IHasher {
  update(data: IDataType): IHasher;
}

export async function createHasher(): Promise<CRC32Hasher> {
  const hasher = await createCRC32();
  return hasher as unknown as CRC32Hasher;
}
