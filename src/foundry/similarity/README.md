# Foundry Similarity Module

Text similarity and normalization utilities implementing the Crucible Foundry Similarity Standard v2.0.0 (2025.10.3).

## Features

- **Multiple Metrics**: Levenshtein, Damerau-Levenshtein (OSA + unrestricted), Jaro-Winkler, substring similarity
- **Normalization Presets**: Four levels (none, minimal, default, aggressive) with Unicode support
- **Rich Suggestion API**: Ranked suggestions with match ranges, reasons, and configurable metrics
- **High Performance**: WASM-backed implementation with <0.1ms p95 latency
- **Turkish Locale Support**: Proper handling of İ/i via locale-aware casefolding

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

### `distance(a: string, b: string, metric?: MetricType): number`

Calculate edit distance or similarity score between two strings.

**Metrics**: `"levenshtein"` (default), `"damerau_osa"`, `"damerau_unrestricted"`, `"jaro_winkler"`, `"substring"`

```typescript
distance("kitten", "sitting"); // 3 (Levenshtein)
distance("abcd", "abdc", "damerau_osa"); // 1 (transposition)
distance("CA", "ABC", "damerau_unrestricted"); // 2
distance("hello", "hallo", "jaro_winkler"); // 0.88 (similarity score)
distance("hello world", "world", "substring"); // 0.625 (substring match)
```

**Note**: `jaro_winkler` and `substring` return similarity scores (0-1), not distances.

### `score(a: string, b: string, metric?: MetricType): number`

Calculate normalized similarity score (0.0 to 1.0).

```typescript
score("kitten", "sitting"); // 0.5714... (Levenshtein)
score("hello", "hallo", "jaro_winkler"); // 0.88
score("test", "test", "damerau_osa"); // 1.0
```

### `normalize(value: string, preset?: NormalizationPreset, locale?: string): string`

Normalize text using predefined presets.

**Presets**: `"none"`, `"minimal"`, `"default"` (default), `"aggressive"`

```typescript
normalize("  HELLO  "); // 'hello' (default: trim + casefold)
normalize("  Café  ", "minimal"); // 'Café' (trim only)
normalize("Café-Zürich!", "aggressive"); // 'cafezurich' (strip all)
normalize("İstanbul", "default", "tr"); // 'istanbul' (Turkish locale)
```

**Preset Behaviors**:

- `none`: No transformation
- `minimal`: NFC normalization + trim
- `default`: NFC + casefold + trim
- `aggressive`: NFKD + casefold + strip accents + remove punctuation + trim

**Legacy API** (backward compatible):

```typescript
normalize("café", { stripAccents: true }); // 'cafe'
normalize("İstanbul", { locale: "tr" }); // 'istanbul'
```

### `suggest(input: string, candidates: string[], options?: SuggestOptions): Suggestion[]`

Get ranked suggestions with rich metadata.

```typescript
suggest("docscrib", ["docscribe", "crucible", "config"]);
// [
//   {
//     value: 'docscribe',
//     score: 0.889,
//     reason: 'normalized_levenshtein=0.8889',
//     normalizedValue: 'docscribe'
//   }
// ]

suggest("test", ["testing", "tested"], {
  metric: "jaro_winkler",
  normalizePreset: "aggressive",
  minScore: 0.8,
  maxSuggestions: 2,
});
```

**Options**:

- `metric?: MetricType` - Similarity metric (default: `"levenshtein"`)
- `normalizePreset?: NormalizationPreset` - Text normalization (default: `"default"`)
- `minScore?: number` - Minimum threshold (default: 0.6)
- `maxSuggestions?: number` - Max results (default: 3)
- `preferPrefix?: boolean` - Boost prefix matches for Jaro-Winkler
- `normalize?: boolean` - Legacy option (use `normalizePreset` instead)

**Suggestion Interface**:

```typescript
interface Suggestion {
  value: string; // Original candidate
  score: number; // Similarity score (0-1)
  matchedRange?: [number, number]; // Match position (substring only)
  reason?: string; // Score explanation
  normalizedValue?: string; // After normalization
}
```

### Utility Functions

#### `casefold(value: string, locale?: string): string`

Unicode-aware case folding with locale support.

```typescript
casefold("HELLO"); // 'hello'
casefold("İstanbul", "tr"); // 'istanbul' (Turkish İ → i)
```

#### `stripAccents(value: string): string`

Remove diacritical marks.

```typescript
stripAccents("café"); // 'cafe'
stripAccents("naïve"); // 'naive'
```

#### `equalsIgnoreCase(a: string, b: string, options?: NormalizeOptions): boolean`

Case-insensitive comparison.

```typescript
equalsIgnoreCase("HELLO", "hello"); // true
equalsIgnoreCase("café", "cafe", { stripAccents: true }); // true
```

## Performance

Benchmarks on Apple M-series hardware (10,000 iterations, 128-char strings):

- **Levenshtein**: 0.014ms average, 0.020ms p95
- **Damerau OSA**: 0.016ms average, 0.024ms p95
- **Jaro-Winkler**: 0.012ms average, 0.018ms p95
- **Target**: <1.0ms p95 ✅

WASM implementation provides ~4x performance improvement over pure TypeScript.

## Unicode Support

- **Grapheme Clusters**: Handles multi-codepoint characters (emoji, combining marks)
- **Normalization Forms**: NFC (default) and NFKD (aggressive preset)
- **Locale-Aware**: Turkish (tr), Lithuanian (lt), Azeri (az) locale support
- **Accent Stripping**: NFD decomposition + combining mark removal

## Migration from v1.0

### Breaking Changes

- `VERSION` changed from `'1.0.0'` to `'2.0.0'`
- `normalize()` now accepts preset string instead of only options object

### New Features

- Multiple distance metrics via `metric` parameter
- Normalization presets for common use cases
- Rich suggestion metadata (matchedRange, reason, normalizedValue)
- Turkish locale support in normalization

### Backward Compatibility

Legacy API signatures still supported:

```typescript
// v1 style - still works
normalize("café", { stripAccents: true });
suggest("test", candidates, { normalize: true });

// v2 style - recommended
normalize("café", "aggressive");
suggest("test", candidates, { normalizePreset: "default" });
```

## Type Definitions

```typescript
type MetricType =
  | "levenshtein"
  | "damerau_osa"
  | "damerau_unrestricted"
  | "jaro_winkler"
  | "substring";

type NormalizationPreset = "none" | "minimal" | "default" | "aggressive";

interface Suggestion {
  value: string;
  score: number;
  matchedRange?: [number, number];
  reason?: string;
  normalizedValue?: string;
}

interface SuggestOptions {
  minScore?: number;
  maxSuggestions?: number;
  metric?: MetricType;
  normalizePreset?: NormalizationPreset;
  preferPrefix?: boolean;
  jaroPrefixScale?: number;
  jaroMaxPrefix?: number;
  normalize?: boolean; // deprecated
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
  const result = distance("test", "best");
} catch (error) {
  if (error instanceof SimilarityError) {
    console.error("Similarity error:", error.message);
  }
}
```

## Standards Compliance

Implements **Crucible Foundry Similarity Standard v2.0.0** (2025.10.3):

- ✅ Levenshtein distance (Wagner-Fischer algorithm)
- ✅ Damerau-Levenshtein OSA (Optimal String Alignment)
- ✅ Damerau-Levenshtein unrestricted (true Damerau)
- ✅ Jaro-Winkler similarity with prefix scaling
- ✅ Longest common substring (LCS) similarity
- ✅ Four normalization presets with Unicode support
- ✅ Rich suggestion API with metadata

**Powered by**: `@3leaps/string-metrics-wasm` v0.3.8

## Known Limitations

- Substring fixtures use different field names (12 tests skipped)
- Token-based similarity (cosine, Jaccard) not implemented
- Phonetic algorithms (Soundex, Metaphone) not implemented

See `.plans/memos/similarity-turkish-locale-support.md` for locale enhancement roadmap.
