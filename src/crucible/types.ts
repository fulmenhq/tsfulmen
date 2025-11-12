export type AssetCategory = "docs" | "schemas" | "config" | "templates";

export interface CrucibleVersion {
  readonly version: string;
  readonly commit: string;
  readonly syncedAt: string | null;
  readonly dirty: boolean;
  readonly syncMethod: "local-path" | "git-ref" | "git-tag" | string;
}

export interface AssetSummary {
  readonly id: string;
  readonly category: AssetCategory;
  readonly path: string;
  readonly size: number;
  readonly modified: Date;
  readonly checksum?: string;
}

export interface AssetListOptions {
  readonly prefix?: string;
  readonly limit?: number;
}

export interface DocumentationMetadata {
  readonly title?: string;
  readonly status?: string;
  readonly tags?: readonly string[];
  readonly author?: string;
  readonly date?: string;
  readonly lastUpdated?: string;
  readonly description?: string;
}

export interface DocumentationFilter extends AssetListOptions {
  readonly status?: string;
  readonly tags?: readonly string[];
}

export interface DocumentationSummary extends AssetSummary {
  readonly metadata?: DocumentationMetadata;
}

export type SchemaKind =
  | "observability"
  | "library"
  | "terminal"
  | "config"
  | "meta"
  | "api"
  | "ascii"
  | "assessment"
  | "content"
  | "error-handling"
  | "pathfinder"
  | "schema-validation"
  | "taxonomy"
  | "tooling"
  | string;

export interface SchemaSummary extends AssetSummary {
  readonly kind: SchemaKind;
  readonly version: string;
}

export interface ConfigSummary extends AssetSummary {
  readonly configCategory: string;
  readonly version: string;
}
