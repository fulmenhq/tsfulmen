# Pathfinder Module

Enterprise filesystem traversal and repository root discovery with security-first design, pattern matching, and comprehensive observability.

## Features

- ✅ **Repository Root Discovery**: Find .git, package.json, and other markers with security boundaries
- ✅ **Filesystem Traversal**: Recursive directory scanning with glob patterns
- ✅ **Ignore File Support**: `.fulmenignore` and `.gitignore` with nested precedence
- ✅ **Optional Checksums**: FulHash integration (xxh3-128, sha256) with streaming
- ✅ **Path Constraints**: Enforce repository/workspace boundaries (WARN, STRICT, PERMISSIVE)
- ✅ **Security First**: Boundary enforcement, max-depth limiting, symlink loop detection
- ✅ **Cross-Platform**: POSIX, Windows drive letters, UNC paths
- ✅ **Comprehensive Errors**: Structured errors with correlation IDs and severity
- ✅ **Telemetry Integration**: Observability metrics for operations

## Repository Root Discovery

Find repository markers (`.git`, `package.json`, etc.) by walking up the directory tree with security boundaries and constraints.

### Quick Start

```typescript
import { findRepositoryRoot, GitMarkers } from "@fulmenhq/tsfulmen/pathfinder";

// Find Git repository root from current directory
const gitRoot = await findRepositoryRoot(process.cwd(), GitMarkers);
console.log(`Git root: ${gitRoot}`);

// Find Node.js project root
import { NodeMarkers } from "@fulmenhq/tsfulmen/pathfinder";
const nodeRoot = await findRepositoryRoot("./src/components", NodeMarkers);
```

### Predefined Marker Sets

```typescript
import {
  GitMarkers,        // [".git"]
  NodeMarkers,       // ["package.json", "package-lock.json"]
  PythonMarkers,     // ["pyproject.toml", "setup.py", "requirements.txt", "Pipfile"]
  GoModMarkers,      // ["go.mod"]
  MonorepoMarkers,   // ["lerna.json", "pnpm-workspace.yaml", "nx.json", "turbo.json", "rush.json"]
} from "@fulmenhq/tsfulmen/pathfinder";

// Use any marker set
const pythonRoot = await findRepositoryRoot("./app", PythonMarkers);
```

### API Reference

```typescript
function findRepositoryRoot(
  startPath: string,
  markers?: string[],
  options?: FindRepoOptions
): Promise<string>
```

**Parameters:**
- `startPath` - Directory to start search from
- `markers` - Array of marker files/directories (default: `[".git"]`)
- `options` - Optional configuration

**Returns:** Absolute path to repository root containing marker

**Throws:**
- `REPOSITORY_NOT_FOUND` - No marker found within constraints
- `INVALID_START_PATH` - Start path doesn't exist or isn't a directory
- `INVALID_BOUNDARY` - Boundary is not an ancestor of start path
- `TRAVERSAL_LOOP` - Cyclic symlink detected (when `followSymlinks=true`)
- `SECURITY_VIOLATION` - Constraint prevents marker discovery

### Default Behavior

**Defaults** (security-first):
- **`maxDepth`**: `10` - Prevents excessive traversal
- **`boundary`**: User home directory (if start path is under home), otherwise filesystem root
- **`stopAtFirst`**: `true` - Returns first marker found (closest to start path)
- **`followSymlinks`**: `false` - Security: symlinks not followed by default
- **`constraint`**: `undefined` - No additional path constraints

**Override defaults:**

```typescript
const root = await findRepositoryRoot("./deep/nested/dir", GitMarkers, {
  maxDepth: 20,           // Search up to 20 levels
  boundary: "/projects",  // Stop at /projects
  stopAtFirst: false,     // Find deepest marker (closest to root)
  followSymlinks: true,   // Follow symlinks (with loop detection)
});
```

### Safe Usage Patterns

#### Boundary + Constraint Together

Combine explicit boundary with path constraint for maximum security:

```typescript
import { ConstraintType, EnforcementLevel } from "@fulmenhq/tsfulmen/pathfinder";

// Secure search within project boundary
const root = await findRepositoryRoot("./src/components", GitMarkers, {
  boundary: "/home/user/projects/myapp",  // Don't search above project
  constraint: {
    root: "/home/user/projects",           // Enforce workspace constraint
    type: ConstraintType.WORKSPACE,
    enforcementLevel: EnforcementLevel.STRICT,
  },
});

// This prevents:
// - Searching above /home/user/projects/myapp (boundary)
// - Returning results outside /home/user/projects (constraint)
// - Data leakage across workspace boundaries
```

#### Find Deepest Marker (Monorepo Root)

Use `stopAtFirst=false` to find the deepest marker (closest to filesystem root), useful for finding monorepo roots when nested repositories exist:

```typescript
// Directory structure:
//   /monorepo/.git
//   /monorepo/packages/app/.git
//   /monorepo/packages/app/src/index.ts

// Start from deeply nested file
const currentFile = "/monorepo/packages/app/src/index.ts";

// stopAtFirst=true (default) - finds /monorepo/packages/app
const packageRoot = await findRepositoryRoot(
  currentFile,
  GitMarkers,
  { stopAtFirst: true }
);
console.log(packageRoot); // => /monorepo/packages/app

// stopAtFirst=false - finds /monorepo (deepest/monorepo root)
const monorepoRoot = await findRepositoryRoot(
  currentFile,
  GitMarkers,
  { stopAtFirst: false }
);
console.log(monorepoRoot); // => /monorepo
```

### Cross-Platform Behavior

Pathfinder handles platform-specific filesystem roots correctly:

**POSIX (Linux, macOS)**:
- Filesystem root: `/`
- Boundary validation: `startPath.startsWith(boundary)`

**Windows Drive Roots**:
- Drive roots: `C:\`, `D:\`, etc.
- Traversal stops at drive root automatically

**Windows UNC Paths**:
- UNC roots: `\\server\share`
- Traversal stops at UNC root automatically

**Example - Cross-platform boundary:**

```typescript
// Works correctly on all platforms
const root = await findRepositoryRoot(process.cwd(), GitMarkers, {
  // POSIX: /home/user/projects
  // Windows: C:\Users\user\projects
  boundary: join(homedir(), "projects"),
});
```

### Symlink Handling

**Default: `followSymlinks=false` (Security)**

Symlinks are not followed by default to prevent:
- Directory escape attacks
- Cyclic symlink loops
- Unintended traversal outside boundaries

**Opt-in: `followSymlinks=true` (With Loop Detection)**

Enable with automatic loop detection:

```typescript
const root = await findRepositoryRoot("./src", GitMarkers, {
  followSymlinks: true,  // Enables symlink following
});

// If cyclic symlink detected:
// throw FulmenError {
//   code: "pathfinder.traversal_loop",
//   message: "Cyclic symlink detected at /path/to/symlink",
//   context: { currentDir, realPath, depth }
// }
```

**Loop Detection Mechanism:**
- Tracks visited real paths (via `realpath()`)
- Detects cycles when same real path visited twice
- Throws `TRAVERSAL_LOOP` error with context

### Error Mapping Table

| Error Code              | When Thrown                                      | Severity | Context                              |
|-------------------------|--------------------------------------------------|----------|--------------------------------------|
| `REPOSITORY_NOT_FOUND`  | No marker found within max depth/boundary       | Medium   | `{ startPath, markers, maxDepth }`   |
| `INVALID_START_PATH`    | Start path doesn't exist or isn't a directory   | High     | `{ startPath }`                      |
| `INVALID_BOUNDARY`      | Boundary is not ancestor of start path          | High     | `{ startPath, boundary }`            |
| `TRAVERSAL_LOOP`        | Cyclic symlink detected (followSymlinks=true)   | High     | `{ currentDir, realPath, depth }`    |
| `SECURITY_VIOLATION`    | Start path outside constraint root              | High     | `{ startPath, constraint }`          |

**Error Handling Example:**

```typescript
import { PathfinderErrorCode } from "@fulmenhq/tsfulmen/pathfinder";

try {
  const root = await findRepositoryRoot("./src", GitMarkers);
  console.log(`Found: ${root}`);
} catch (error) {
  if (error.data?.code === PathfinderErrorCode.REPOSITORY_NOT_FOUND) {
    console.error("No repository marker found");
    console.error(`Searched from: ${error.data.context.startPath}`);
    console.error(`Max depth: ${error.data.context.maxDepth}`);
  } else if (error.data?.code === PathfinderErrorCode.TRAVERSAL_LOOP) {
    console.error("Cyclic symlink detected:", error.data.context);
  } else {
    throw error; // Re-throw unexpected errors
  }
}
```

### Multiple Markers (Priority Order)

Markers are checked in array order - first match wins:

```typescript
// NodeMarkers = ["package.json", "package-lock.json"]
// If both exist, package.json is found first

const root = await findRepositoryRoot("./app", NodeMarkers);

// Custom markers with priority
const customMarkers = [
  "workspace.yaml",  // Highest priority
  "package.json",    // Fallback
  ".git",            // Last resort
];

const root = await findRepositoryRoot("./src", customMarkers);
```

### Helper Functions

Create options fluently with helper functions:

```typescript
import {
  withMaxDepth,
  withBoundary,
  withStopAtFirst,
  withConstraint,
  withFollowSymlinks,
} from "@fulmenhq/tsfulmen/pathfinder";

// Combine helpers
const options = {
  ...withMaxDepth(15),
  ...withBoundary("/home/user/projects"),
  ...withFollowSymlinks(false),
};

const root = await findRepositoryRoot("./src", GitMarkers, options);
```

## Performance Considerations

**Repository Root Discovery:**
- **Target**: <10ms for typical depth (3-5 levels)
- **Optimization**: `stopAtFirst=true` (default) for early exit
- **Limit**: Default `maxDepth=10` prevents excessive traversal
- **Caching**: Not implemented (single-call discovery)

**Best Practices:**
- Use `stopAtFirst=true` (default) unless you need deepest marker
- Set explicit `boundary` when project structure is known
- Keep `maxDepth` reasonable (default 10 is sufficient for most projects)
- Avoid `followSymlinks=true` unless necessary (security + performance)

## Security Considerations

### Boundary Enforcement

**Default Boundary:**
- User home directory if start path is under home
- Filesystem root otherwise (prevents rejection of temp directories)

**Explicit Boundary:**
- Must be ancestor of start path (validated)
- Prevents traversal above specified directory
- Throws `INVALID_BOUNDARY` if validation fails

### Path Constraints

Additional upper boundary enforcement:

```typescript
// Constraint prevents discovery outside /home/user/workspace
const root = await findRepositoryRoot("./project/src", GitMarkers, {
  constraint: {
    root: "/home/user/workspace",
    type: ConstraintType.WORKSPACE,
    enforcementLevel: EnforcementLevel.STRICT,
  },
});

// If .git exists at /home/user/.git (above constraint):
// throw REPOSITORY_NOT_FOUND (constraint prevents discovery)
```

### Data Leakage Prevention

**Protection mechanisms:**
1. **Boundary ceiling**: Never walk above explicit boundary or home directory
2. **Constraint validation**: Reject start paths outside constraint root
3. **Max depth**: Default 10 levels prevents excessive traversal
4. **Symlink safety**: Not followed by default; loop detection when enabled
5. **Filesystem root stop**: Automatic stop at root/drive/UNC boundaries

## Migration from Ad-hoc Helpers

If you have custom "walk-up" or "find-root" helpers, migrate to `findRepositoryRoot()`:

**Before** (ad-hoc helper):
```typescript
async function findGitRoot(startDir: string): Promise<string | null> {
  let current = startDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(current, ".git"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}
```

**After** (pathfinder):
```typescript
import { findRepositoryRoot, GitMarkers } from "@fulmenhq/tsfulmen/pathfinder";

const gitRoot = await findRepositoryRoot(startDir, GitMarkers);
// Throws REPOSITORY_NOT_FOUND instead of returning null
// Includes boundary enforcement and security checks
```

## See Also

- [Crucible Pathfinder Extension Spec](../../docs/crucible-ts/standards/library/extensions/pathfinder.md)
- [Repository Root Discovery Feature Brief](../../.plans/active/v0.1.9/pathfinder-repo-root-feature-brief.md)
- [FulHash Module](../fulhash/README.md) - Checksum integration
- [Foundry Patterns](../foundry/README.md) - Pattern matching

---

**Module Weaver** 🧵 | Generated with [Claude Code](https://claude.com/claude-code) | Supervised by @3leapsdave
