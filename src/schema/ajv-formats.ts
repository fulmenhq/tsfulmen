import type Ajv from "ajv";
import addFormats from "ajv-formats";

export interface FulmenAjvFormatsOptions {
  mode?: "fast" | "full";
  formats?: string[];
}

const DEFAULT_FORMATS = [
  "date-time",
  "email",
  "hostname",
  "ipv4",
  "ipv6",
  "uri",
  "uri-reference",
  "uuid",
];

/**
 * Apply Fulmen-standard AJV format support.
 *
 * Useful when configuring AJV in other frameworks (e.g. Fastify) so JSON Schema
 * `format` keywords are enforced consistently.
 */
export function applyFulmenAjvFormats(ajv: Ajv, options: FulmenAjvFormatsOptions = {}): Ajv {
  const mode = options.mode ?? "fast";
  const formats = options.formats ?? DEFAULT_FORMATS;

  // ajv-formats types use a string-literal union; allow callers to supply strings.
  addFormats(ajv, { mode, formats: formats as unknown as never[] });
  return ajv;
}
