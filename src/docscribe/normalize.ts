/**
 * Normalization utilities for DocScribe module inputs.
 */

const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });

export type NormalizedInput = {
  readonly content: string;
  readonly original: string | Uint8Array | ArrayBufferLike;
};

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Normalize supported input types to a UTF-8 string with consistent newlines.
 */
export function normalizeInput(input: string | Uint8Array | ArrayBufferLike): NormalizedInput {
  let content: string;

  if (typeof input === 'string') {
    content = input;
  } else if (input instanceof Uint8Array) {
    content = decoder.decode(input);
  } else {
    content = decoder.decode(new Uint8Array(input));
  }

  const normalized = normalizeNewlines(stripBom(content));
  return { content: normalized, original: input };
}
