import type { Identity } from "./types.js";

export type RuntimeName = "bun" | "node" | "unknown";

export interface RuntimeInfo {
  service: {
    name: string;
    vendor?: string;
    version?: string;
  };
  runtime: {
    name: RuntimeName;
    version?: string;
  };
  platform: {
    os: NodeJS.Platform;
    arch: string;
  };
}

export interface BuildRuntimeInfoOptions {
  identity?: Identity;
  version?: string;
  serviceName?: string;
  vendor?: string;
}

function detectRuntime(): { name: RuntimeName; version?: string } {
  const versions = process.versions as unknown as Record<string, string | undefined>;

  if (typeof versions.bun === "string" && versions.bun.length > 0) {
    return { name: "bun", version: versions.bun };
  }

  if (typeof versions.node === "string" && versions.node.length > 0) {
    return { name: "node", version: versions.node };
  }

  return { name: "unknown" };
}

/**
 * Build a minimal runtime info payload suitable for discovery endpoints.
 */
export function buildRuntimeInfo(options: BuildRuntimeInfoOptions = {}): RuntimeInfo {
  const runtime = detectRuntime();

  const serviceName = options.serviceName ?? options.identity?.app.binary_name ?? "unknown-service";
  const vendor = options.vendor ?? options.identity?.app.vendor;

  return {
    service: {
      name: serviceName,
      vendor,
      version: options.version,
    },
    runtime,
    platform: {
      os: process.platform,
      arch: process.arch,
    },
  };
}
