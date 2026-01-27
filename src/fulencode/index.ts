/**
 * Fulencode - canonical encoding/decoding facade.
 */

export const VERSION = "0.1.0";

export * from "./errors.js";
export * from "./types.js";

import { decode, encode } from "./fulencode.js";
export { decode, encode };

export const fulencode = {
  encode,
  decode,
} as const;
