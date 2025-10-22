# Foundry Similarity Module

Text similarity and normalization utilities implementing the Crucible Foundry Similarity Standard (2025.10.2).

## Features

- **Levenshtein Distance**: Wagner-Fischer algorithm with O(min(m,n)) space complexity
- **Similarity Scoring**: Normalized scores from 0.0 (different) to 1.0 (identical)
- **Unicode Normalization**: Trim, case folding, and optional accent stripping
- **Suggestion API**: Ranked suggestions with configurable thresholds
- **High Performance**: <0.1ms p95 latency for 128-char strings

## Installation

```typescript
import {
  distance,
  score,
  normalize,
  suggest,
} from "@fulmenhq/tsfulmen/foundry/similarity";
// or
import {
  distance,
  score,
  normalize,
  suggest,
} from "@fulmenhq/tsfulmen/foundry";
```

## API Reference

### `distance(a: string, b: string): number`

Calculate Levenshtein edit distance between two strings.

```typescript
distance("kitten", "sitting"); // 3
distance("hello", "hello"); // 0
distance("café", "cafe"); // 1
```

### `score(a: string, b: string): number`

Calculate normalized similarity score (0.0 to 1.0).

```typescript
score("kitten", "sitting"); // 0.5714...
score("hello", "hello"); // 1.0
score("", "test"); // 0.0
```

### `normalize(value: string, options?: NormalizeOptions): string`

Normalize text with configurable options.

```typescript
normalize("  HELLO  "); // 'hello'
normalize("café", { stripAccents: true }); // 'cafe'
normalize("İstanbul", { locale: "tr" }); // 'istanbul'
```

**Options:**

- `stripAccents?: boolean` - Remove diacritical marks (default: false)
- `locale?: string` - Locale for case folding (default: undefined)

### `suggest(input: string, candidates: string[], options?: SuggestOptions): Suggestion[]`

Get ranked suggestions for input string.

```typescript
suggest("docscrib", ["docscribe", "crucible", "config"]);
// [{ value: 'docscribe', score: 0.888... }]

suggest("test", ["test1", "test2", "test3"], { maxSuggestions: 2 });
// [{ value: 'test1', score: 0.8 }, { value: 'test2', score: 0.8 }]
```

**Options:**

- `minScore?: number` - Minimum similarity threshold (default: 0.6)
- `maxSuggestions?: number` - Maximum results to return (default: 3)
- `normalize?: boolean` - Apply normalization (default: true)

### Utility Functions

#### `casefold(value: string, locale?: string): string`

Convert to lowercase with optional locale support.

```typescript
casefold("HELLO"); // 'hello'
casefold("İstanbul", "tr"); // 'istanbul'
```

#### `stripAccents(value: string): string`

Remove diacritical marks using NFD decomposition.

```typescript
stripAccents("café"); // 'cafe'
stripAccents("naïve"); // 'naive'
```

#### `equalsIgnoreCase(a: string, b: string, options?: NormalizeOptions): boolean`

Compare strings ignoring case and optionally accents.

```typescript
equalsIgnoreCase("HELLO", "hello"); // true
equalsIgnoreCase("café", "cafe", { stripAccents: true }); // true
```

## Performance

Benchmarks on Apple M-series hardware (10,000 iterations, 128-char strings):

- **Distance**: 0.059ms average, 0.088ms p95
- **Score**: 0.058ms average, 0.087ms p95
- **Target**: <1.0ms p95 ✅

## Unicode Support

- **Grapheme Clusters**: Handles multi-codepoint characters correctly (emoji, combining marks)
- **Case Folding**: Unicode-aware via `toLowerCase()` and `toLocaleLowerCase()`
- **Accent Stripping**: NFD normalization + combining mark removal
- **Turkish Locale**: Special handling for dotted/dotless i

## Known Limitations

Per `.plans/memos/crucible/similarity-exceptions-and-needs.md`:

- Transposition operations count as 2 edits (Damerau-Levenshtein not implemented)
- Substring/prefix matching not supported (full-string distance only)
- See memo for cross-language coordination notes

## Type Definitions

```typescript
interface Suggestion {
  value: string;
  score: number;
}

interface SuggestOptions {
  minScore?: number;
  maxSuggestions?: number;
  normalize?: boolean;
}

interface NormalizeOptions {
  stripAccents?: boolean;
  locale?: string;
}
```

## Error Handling

```typescript
import { SimilarityError } from "@fulmenhq/tsfulmen/foundry/similarity";

try {
  // Operations that might fail
} catch (error) {
  if (error instanceof SimilarityError) {
    console.error("Similarity error:", error.message);
  }
}
```

## Standards Compliance

Implements:

- Crucible Foundry Similarity Standard (2025.10.2)
- Standard Levenshtein distance (Wagner-Fischer algorithm)
- Unicode normalization (NFD decomposition)

Does NOT implement:

- Damerau-Levenshtein (transposition as single operation)
- Jaro-Winkler distance
- Token-based similarity (cosine, Jaccard, etc.)
- Substring/fuzzy matching
