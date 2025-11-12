import { createReadStream } from "node:fs";
import path from "node:path";

import { Algorithm, createStreamHasher } from "../fulhash/index.js";
import { ChecksumAlgorithm, type FileMetadata } from "./types.js";

/**
 * Result fragment returned when calculating a checksum.
 */
export type ChecksumMetadata = Pick<
  FileMetadata,
  "checksum" | "checksumAlgorithm" | "checksumError"
>;

function toFulHashAlgorithm(algorithm: ChecksumAlgorithm): Algorithm {
  switch (algorithm) {
    case ChecksumAlgorithm.SHA256:
      return Algorithm.SHA256;
    default:
      return Algorithm.XXH3_128;
  }
}

/**
 * Calculate the checksum for a single file using FulHash streaming hasher.
 *
 * Returns checksum metadata compatible with Pathfinder metadata schema.
 */
export async function calculateChecksum(
  filePath: string,
  algorithm: ChecksumAlgorithm,
): Promise<ChecksumMetadata> {
  const absolutePath = path.resolve(filePath);

  try {
    const hasher = await createStreamHasher({ algorithm: toFulHashAlgorithm(algorithm) });
    const stream = createReadStream(absolutePath);

    try {
      for await (const chunk of stream) {
        hasher.update(chunk as Uint8Array);
      }
    } catch (error) {
      stream.destroy();
      throw error;
    }

    const digest = hasher.digest();

    return {
      checksum: `${algorithm}:${digest.hex}`,
      checksumAlgorithm: algorithm,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      checksumAlgorithm: algorithm,
      checksumError: message,
    };
  }
}

/**
 * Calculate checksums for a list of files with a simple concurrency limiter.
 */
export async function calculateChecksumsBatch(
  filePaths: string[],
  algorithm: ChecksumAlgorithm,
  concurrency: number = 1,
): Promise<Map<string, ChecksumMetadata>> {
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const results = new Map<string, ChecksumMetadata>();

  if (filePaths.length === 0) {
    return results;
  }

  let index = 0;

  const worker = async (): Promise<void> => {
    while (index < filePaths.length) {
      const currentIndex = index++;
      const filePath = filePaths[currentIndex];
      const metadata = await calculateChecksum(filePath, algorithm);
      results.set(filePath, metadata);
    }
  };

  const workers = Array.from({ length: Math.min(safeConcurrency, filePaths.length) }, () =>
    worker(),
  );
  await Promise.all(workers);

  return results;
}
