import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { CrucibleVersion } from "./types.js";

interface SyncKeysManifest {
  version?: string;
  commit?: string;
  syncedAt?: string;
  dirty?: boolean;
  syncMethod?: string;
}

export function getCrucibleVersion(): CrucibleVersion {
  const metadataPath = join(process.cwd(), ".crucible", "metadata", "sync-keys.yaml");

  try {
    const content = readFileSync(metadataPath, "utf-8");
    const manifest = parseYaml(content) as SyncKeysManifest;

    return {
      version: manifest.version ?? "unknown",
      commit: manifest.commit ?? "unknown",
      syncedAt: manifest.syncedAt ?? null,
      dirty: manifest.dirty ?? false,
      syncMethod: manifest.syncMethod ?? "unknown",
    };
  } catch (_error) {
    return {
      version: "unknown",
      commit: "unknown",
      syncedAt: null,
      dirty: false,
      syncMethod: "unknown",
    };
  }
}
