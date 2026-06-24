# Compile-safe SSOT assets (`bun --compile`)

_Since v0.4.0._

tsfulmen ships SSOT assets — JSON Schemas, JSON-Schema metaschemas, foundry catalogs,
and the telemetry taxonomy — and resolves them through a single **`AssetResolver`** so
they work whether the library runs from npm (`node dist`), from source, or **embedded
in a `bun build --compile` single-file binary** where no asset tree exists on disk.

If you consume tsfulmen normally (npm / `node dist`), there is nothing to do — the
default `auto` mode reads the on-disk asset trees. This guide is for consumers building
compiled binaries (e.g. CDRL workhorses).

## How resolution works

`getAssetResolver()` / `resolveAssets()` pick a backend:

| Mode | Backend | When |
|------|---------|------|
| `auto` (default) | filesystem if the asset tree is present, else embedded | npm/source → fs; compiled binary → embedded |
| `fs` | on-disk `schemas/crucible-ts` + `config/crucible-ts` | force filesystem |
| `embedded` | build-embedded generated modules | force embedded (e.g. tests, compiled binary) |

Override with the `TSFULMEN_ASSET_MODE` env var (`auto` | `fs` | `embedded`) or an
explicit option to `resolveAssets({ mode })`.

```ts
import { getAssetResolver } from "@fulmenhq/tsfulmen/assets";

const resolver = getAssetResolver();              // auto
const yaml = await resolver.read("config/crucible-ts/library/foundry/signals.yaml");
const schemas = await resolver.list(["schemas/crucible-ts/**/*.schema.json"]);
```

Logical paths are **package-root-relative POSIX** paths spanning both the `schemas/`
and `config/` trees, validated against path traversal.

## Building a `bun --compile` binary

Embedded asset modules live in the import graph, so `bun build --compile` bundles them
automatically — no special flags. In a compiled binary, `auto` finds no on-disk tree
and falls back to embedded, so schema validation, foundry catalogs, and standalone
`serve` all work with zero filesystem reads.

```bash
bun build --compile ./your-app.ts --outfile your-app
./your-app serve     # works: signals catalog + metrics server resolve from embedded assets
```

To be explicit (and to test the embedded path even when an asset tree is present):

```bash
TSFULMEN_ASSET_MODE=embedded ./your-app serve
```

## Identity & config in compiled binaries (recap, v0.3.3)

Pair the above with the v0.3.3 ergonomics for fully FS-free startup:

- `registerEmbeddedIdentity(data, { skipValidation })` — register a build-embedded,
  CI-validated app identity without the FS-backed schema registry.
- `loadConfig({ defaults, schema })` — inline config defaults/schema instead of file
  paths.

## Maintaining the embedded assets (tsfulmen maintainers)

The generated modules under `src/assets/generated/` are checked in and derived from the
on-disk SSOT trees:

```bash
make sync-ssot            # refresh schemas/crucible-ts + config/crucible-ts from Crucible
make embed-assets         # regenerate src/assets/generated/ from the on-disk trees
make verify-embedded-assets   # drift guard (also part of check-all)
```

`make build` runs `verify-dist-asset-partition` (public entries stay lean; corpus in one
shared chunk) and the CI build job runs `verify-embedded-compile` (in-binary read +
`serve` proof). Keep the generated modules in sync after any `sync-ssot`.
