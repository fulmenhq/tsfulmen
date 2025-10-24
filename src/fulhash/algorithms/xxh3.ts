import { FulHashError } from '../errors.js';
import { createHasher, initializeWasm } from '../wasm-loader.js';

export async function hashBytes(data: Uint8Array): Promise<Uint8Array> {
  await initializeWasm();
  const hasher = await createHasher();

  hasher.init();
  hasher.update(data);
  return hasher.digest('binary');
}

export async function hashString(
  str: string,
  encoding: 'utf8' | 'utf16le' = 'utf8',
): Promise<Uint8Array> {
  if (encoding !== 'utf8') {
    throw new FulHashError(
      'XXH3-128 only supports UTF-8 encoding. Use utf8 encoding or convert data to Uint8Array.',
    );
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return hashBytes(data);
}
