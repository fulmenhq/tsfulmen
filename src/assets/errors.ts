/**
 * Asset resolution - Error handling
 *
 * Custom error classes for SSOT asset resolution (filesystem or embedded).
 */

export class AssetResolutionError extends Error {
  constructor(
    message: string,
    public readonly assetPath?: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "AssetResolutionError";

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AssetResolutionError);
    }
  }

  static notFound(assetPath: string, mode: string): AssetResolutionError {
    return new AssetResolutionError(`Asset not found (${mode} resolver): ${assetPath}`, assetPath);
  }

  static readFailed(assetPath: string, cause: Error): AssetResolutionError {
    return new AssetResolutionError(
      `Failed to read asset ${assetPath}: ${cause.message}`,
      assetPath,
      cause,
    );
  }

  static baseDirUnavailable(detail: string): AssetResolutionError {
    return new AssetResolutionError(`No SSOT asset base directory available: ${detail}`);
  }
}
