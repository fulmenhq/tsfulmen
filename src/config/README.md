# Config Module

The Config module implements the **Fulmen Config Path Standard** and **Enterprise Three-Layer Configuration** pattern (Defaults → User Config → Environment Variables).

## Features

- **Three-Layer Loading**: Automatically merges configuration from:
  1.  **Defaults**: Required defaults file (base layer)
  2.  **User Config**: Optional user overrides from XDG-compliant paths (YAML/JSON)
  3.  **Environment Variables**: Optional overrides via prefixed environment variables
- **Schema Validation**: Optional validation against Crucible-compliant JSON/YAML schemas
- **Path Resolution**: Cross-platform XDG Base Directory support
- **Metadata**: Detailed information about active layers and paths
- **Type Safety**: Full TypeScript support for configuration objects

## Usage

### Basic Loading

```typescript
import { loadConfig } from "@fulmenhq/tsfulmen/config";
import { loadIdentity } from "@fulmenhq/tsfulmen/appidentity";
import { join } from "node:path";

// 1. Load application identity
const identity = await loadIdentity();

// 2. Define configuration type
interface AppConfig {
  server: {
    host: string;
    port: number;
  };
  logging: {
    level: string;
  };
}

// 3. Load configuration
const { config, metadata } = await loadConfig<AppConfig>({
  identity,
  defaultsPath: join(__dirname, "defaults.yaml"),
});

console.log(config.server.port); // Merged value
console.log(metadata.activeLayers); // ["defaults", "user", "env"]
```

### With Schema Validation

```typescript
import { loadConfig, ConfigValidationError } from "@fulmenhq/tsfulmen/config";

try {
  const { config } = await loadConfig<AppConfig>({
    identity,
    defaultsPath: join(__dirname, "defaults.yaml"),
    schemaPath: join(__dirname, "config.schema.json"), // Enable validation
  });
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error("Validation failed:", error.diagnostics);
  }
}
```

### Environment Variables

The loader automatically maps environment variables to configuration keys using the application's environment prefix (derived from AppIdentity or overridden).

**Mapping Rules:**

- Prefix is stripped (e.g., `MYAPP_`)
- Underscores (`_`) indicate nesting
- Values are coerced (true/false -> boolean, numbers -> number)

**Example:**
Prefix: `MYAPP`
Env Var: `MYAPP_SERVER_PORT=9000`
Config:

```yaml
server:
  port: 9000
```

### User Configuration

User configuration files are searched in standard platform locations (XDG on Linux, AppData on Windows, Library/Application Support on macOS).

Supported formats:

- `.yaml`
- `.yml`
- `.json`

## API Reference

### `loadConfig<T>(options)`

Loads and merges configuration.

**Options:**

- `identity` (required): AppIdentity object
- `defaultsPath` (required): Absolute path to defaults file
- `schemaPath` (optional): Absolute path to schema file for validation
- `envPrefix` (optional): Override environment variable prefix
- `userConfigName` (optional): Override user config filename (default: app name)

**Returns:** `Promise<LoadedConfig<T>>` containing `config` and `metadata`.

### `ConfigPathError` / `ConfigValidationError`

Typed errors for handling loading and validation failures.
