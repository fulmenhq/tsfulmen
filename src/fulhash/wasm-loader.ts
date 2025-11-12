import type { IHasher } from "hash-wasm";
import { createXXHash128 } from "hash-wasm";
import { FulHashError } from "./errors.js";

let isWasmReady = false;
let initPromise: Promise<void> | null = null;

export async function initializeWasm(): Promise<void> {
  if (isWasmReady) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = createXXHash128()
    .then(() => {
      isWasmReady = true;
    })
    .catch((error) => {
      initPromise = null;
      throw new FulHashError(`Failed to initialize hash-wasm XXH3-128 module: ${error.message}`);
    });

  return initPromise;
}

export function isInitialized(): boolean {
  return isWasmReady;
}

export async function createHasher(): Promise<IHasher> {
  if (!isWasmReady) {
    throw new FulHashError("WASM not initialized. Call initializeWasm() first.");
  }
  return createXXHash128();
}
