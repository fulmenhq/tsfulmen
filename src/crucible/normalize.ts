import type { AssetCategory } from "./types.js";

const CATEGORY_BASE_PATHS: Record<AssetCategory, string> = {
  docs: "docs/crucible-ts/",
  schemas: "schemas/crucible-ts/",
  config: "config/crucible-ts/",
  templates: "templates/crucible-ts/",
};

const CATEGORY_EXTENSIONS: Record<AssetCategory, string[]> = {
  docs: [".md"],
  schemas: [".schema.json", ".schema.yaml", ".json", ".yaml"],
  config: [".yaml", ".yml"],
  templates: [],
};

export function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, "/");
}

export function pathToAssetId(fsPath: string, category: AssetCategory): string {
  let normalized = normalizeSeparators(fsPath);

  const basePath = CATEGORY_BASE_PATHS[category];
  if (normalized.startsWith(basePath)) {
    normalized = normalized.slice(basePath.length);
  }

  if (category !== "docs") {
    const extensions = CATEGORY_EXTENSIONS[category];
    for (const ext of extensions) {
      if (normalized.endsWith(ext)) {
        normalized = normalized.slice(0, -ext.length);
        break;
      }
    }
  }

  return normalized;
}

export function assetIdToPath(id: string, category: AssetCategory): string {
  const basePath = CATEGORY_BASE_PATHS[category];

  if (category === "docs") {
    return `${basePath}${id}`;
  }

  const extensions = CATEGORY_EXTENSIONS[category];
  const primaryExt = extensions[0] || "";
  return `${basePath}${id}${primaryExt}`;
}

export function validateAssetId(id: string, category: AssetCategory): boolean {
  if (!id || id.includes("\\")) {
    return false;
  }

  if (id.startsWith("/") || id.endsWith("/")) {
    return false;
  }

  if (category === "docs") {
    return id.endsWith(".md");
  }

  const extensions = CATEGORY_EXTENSIONS[category];
  for (const ext of extensions) {
    if (id.endsWith(ext)) {
      return false;
    }
  }

  return true;
}

export function extractVersion(id: string): string | null {
  const versionMatch = id.match(/\/v(\d+\.\d+\.\d+)\//);
  if (versionMatch) {
    return versionMatch[1];
  }

  const versionDirMatch = id.match(/\/(v\d+\.\d+\.\d+)\//);
  if (versionDirMatch) {
    return versionDirMatch[1];
  }

  return null;
}

export function extractSchemaKind(id: string): string {
  const firstSlash = id.indexOf("/");
  if (firstSlash === -1) {
    return "unknown";
  }
  return id.slice(0, firstSlash);
}

export function extractConfigCategory(id: string): string {
  const firstSlash = id.indexOf("/");
  if (firstSlash === -1) {
    return "unknown";
  }
  return id.slice(0, firstSlash);
}
