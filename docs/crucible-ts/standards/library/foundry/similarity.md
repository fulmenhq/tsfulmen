---
title: "Foundry Text Similarity & Normalization Standard"
description: "Standard for text comparison, distance metrics, and normalization utilities in Fulmen helper libraries"
author: "Schema Cartographer"
date: "2025-10-22"
last_updated: "2025-10-22"
status: "stable"
tags:
  ["foundry", "similarity", "normalization", "text", "levenshtein", "2025.10.2"]
---

# Foundry Text Similarity & Normalization Standard

## Overview

The Foundry similarity and normalization utilities provide standardized text comparison capabilities across all Fulmen helper libraries. This enables consistent fuzzy matching, "Did you mean...?" suggestions, and Unicode-aware text processing for Crucible shim error messages, CLI search, and Docscribe lookups.

## Scope

Helper libraries MUST implement:

1. **Levenshtein distance** - Edit distance calculation with early-exit optimizations
2. **Similarity scoring** - Normalized distance as 0.0–1.0 score
3. **Suggestion API** - Generate ranked suggestions from candidate lists
4. **Normalization helpers** - Unicode-aware case folding, accent stripping, whitespace handling

## Non-Goals (2025.10.2)

- Advanced metrics (Jaro-Winkler, Damerau-Levenshtein)
- Language-specific tokenization beyond Unicode normalization
- Locale-aware collation beyond case folding
- ML-based ranking or embeddings

## API Surface

### Distance & Similarity

| Operation  | Go                               | Python                                       | TypeScript                                          |
| ---------- | -------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Distance   | `similarity.Distance(a, b) int`  | `similarity.distance(a: str, b: str) -> int` | `similarity.distance(a: string, b: string): number` |
| Similarity | `similarity.Score(a, b) float64` | `similarity.score(a: str, b: str) -> float`  | `similarity.score(a: string, b: string): number`    |

**Distance**:

- Uses dynamic programming Levenshtein algorithm
- Early-exit optimization when length difference exceeds threshold
- Returns edit distance as non-negative integer
- Empty strings: `Distance("", "") == 0`

**Score**:

- Returns normalized similarity: `1 - distance / max(len(a), len(b))`
- Range: `0.0` (completely different) to `1.0` (identical)
- Empty strings: `Score("", "") == 1.0`

### Suggestion API

Generate ranked suggestions from a candidate list based on similarity to input.

**Signature** (language-idiomatic):

```go
// Go
func Suggest(input string, candidates []string, opts SuggestOptions) []Suggestion

type Suggestion struct {
    Value string
    Score float64
}

type SuggestOptions struct {
    MinScore       float64 // Default: 0.6
    MaxSuggestions int     // Default: 3
    Normalize      bool    // Default: true
}
```

```python
# Python
def suggest(
    input: str,
    candidates: list[str],
    *,
    min_score: float = 0.6,
    max_suggestions: int = 3,
    normalize: bool = True
) -> list[Suggestion]:
    ...

@dataclass
class Suggestion:
    value: str
    score: float
```

```typescript
// TypeScript
function suggest(
  input: string,
  candidates: string[],
  options?: SuggestOptions,
): Suggestion[];

interface Suggestion {
  value: string;
  score: number;
}

interface SuggestOptions {
  minScore?: number; // Default: 0.6
  maxSuggestions?: number; // Default: 3
  normalize?: boolean; // Default: true
}
```

**Behavior**:

1. Optionally normalize input and candidates (if `normalize: true`)
2. Calculate similarity score for each candidate
3. Filter candidates with score ≥ `minScore`
4. Sort by score (descending), then alphabetically for ties
5. Return top `maxSuggestions` results

**Default Parameters Rationale**:

- `MinScore = 0.6` - Empirically balances helpful suggestions vs. noise
- `MaxSuggestions = 3` - Avoids overwhelming users with too many options
- `Normalize = true` - Most use cases benefit from case-insensitive matching

### Normalization Helpers

| Helper                          | Purpose                                                             |
| ------------------------------- | ------------------------------------------------------------------- |
| `Normalize(value, opts)`        | Apply trim, casefold, optional accent stripping                     |
| `Casefold(value, locale?)`      | Unicode-aware lowercasing (default simple casefold)                 |
| `EqualsIgnoreCase(a, b, opts?)` | Compare strings using normalization pipeline                        |
| `StripAccents(value)`           | Remove diacritics (NFD decomposition + filter combining characters) |

**Options**:

```go
// Go
type NormalizeOptions struct {
    StripAccents bool   // Default: false
    Locale       string // Default: "" (simple casefold)
}
```

**Normalization Pipeline** (`Normalize` implementation):

1. Trim leading/trailing whitespace
2. Apply Unicode case folding (simple or locale-specific)
3. Optionally strip accents via NFD normalization
4. Return normalized string

**Accent Stripping Algorithm**:

When `StripAccents: true`:

1. Normalize to NFD (Unicode Normalization Form Decomposed)
2. Filter out characters in Unicode category Mn (Nonspacing_Mark)
3. Re-compose to NFC if needed

Examples:

- `"café"` → `"cafe"`
- `"naïve"` → `"naive"`
- `"Zürich"` → `"Zurich"`

**Locale Support**:

- Default (`locale: ""`): Simple Unicode case folding
- Turkish (`locale: "tr"`): Handle dotted/dotless i correctly
  - `"İstanbul"` → `"istanbul"` (not `"i̇stanbul"`)
- Other locales: Libraries MAY support additional locales

### Error Handling

All functions MUST handle edge cases gracefully:

- Empty strings: Valid inputs, return appropriate defaults
- Null/undefined/nil: Raise appropriate language-specific error
- Non-string types: Type system enforcement (compile-time or runtime)
- Invalid locale: Fall back to simple casefold, optionally log warning

## Shared Fixtures

Crucible provides cross-language validation fixtures:

**Schema**: `schemas/library/foundry/v1.0.0/similarity.schema.json`
**Fixtures**: `config/library/foundry/similarity-fixtures.yaml`

### Fixture Categories

1. **Distance/Score Test Cases**
   - ASCII strings (basic edit operations)
   - Unicode strings (emoji, CJK, RTL scripts)
   - Edge cases (empty, identical, completely different)

2. **Normalization Tests**
   - Whitespace trimming
   - Case folding (simple and Turkish locale)
   - Accent stripping (various diacritics)

3. **Suggestion Scenarios**
   - Typical CLI typo corrections
   - Asset discovery suggestions
   - Threshold behavior validation

### Fixture Format

```yaml
version: "1.0.0"
test_cases:
  - category: "distance"
    cases:
      - input_a: "kitten"
        input_b: "sitting"
        expected_distance: 3
        expected_score: 0.5714 # 1 - 3/7
        description: "Classic Levenshtein example"

  - category: "normalization"
    cases:
      - input: "  Café  "
        options:
          strip_accents: true
        expected: "cafe"
        description: "Trim + casefold + accent stripping"

  - category: "suggestions"
    cases:
      - input: "docscrib"
        candidates: ["docscribe", "crucible-shim", "config-path-api"]
        options:
          min_score: 0.6
          max_suggestions: 3
        expected:
          - value: "docscribe"
            score: 0.8889 # 1 - 1/9
        description: "Typo correction for module name"
```

## Performance Requirements

### Benchmark Targets

| Language   | 128-char strings | Hardware Baseline |
| ---------- | ---------------- | ----------------- |
| Go         | ≤0.5ms (p95)     | M-series / x86-64 |
| Python     | ≤1.0ms (p95)     | M-series / x86-64 |
| TypeScript | ≤1.0ms (p95)     | M-series / x86-64 |

**Measurement Methodology**:

- Use high-resolution timers (Go: `testing.B`, Python: `timeit`, TypeScript: `perf_hooks`)
- Run 10,000 iterations per test
- Report p50 and p95 latencies
- Test with 128-character strings (typical CLI/asset name length)
- Document exact CPU model in benchmark results

### Optimization Strategies

**Required**:

- Early-exit when length difference exceeds remaining budget
- Single-pass normalization (avoid redundant string copies)

**Optional**:

- Wagner-Fischer algorithm with linear space optimization
- SIMD for character comparisons (if language/platform supports)
- Memoization for repeated candidates (caller-side caching)

## Implementation Guidelines

### Algorithm Choice

Use **Wagner-Fischer dynamic programming** for Levenshtein distance:

```
distance(a, b):
  if len(a) == 0: return len(b)
  if len(b) == 0: return len(a)

  matrix[0..len(a)+1][0..len(b)+1]
  for i in 0..len(a):
    matrix[i][0] = i
  for j in 0..len(b):
    matrix[0][j] = j

  for i in 1..len(a):
    for j in 1..len(b):
      cost = 0 if a[i-1] == b[j-1] else 1
      matrix[i][j] = min(
        matrix[i-1][j] + 1,      // deletion
        matrix[i][j-1] + 1,      // insertion
        matrix[i-1][j-1] + cost  // substitution
      )

  return matrix[len(a)][len(b)]
```

**Space Optimization**: Use two-row approach (O(min(m, n)) space instead of O(m\*n))

### Unicode Handling

- **Go**: Use `unicode` package for case folding, `norm` for NFD/NFC
- **Python**: Use `unicodedata` module for normalization, `str.casefold()` for case folding
- **TypeScript**: Use `Intl.Collator` or polyfill for case folding, normalize via `String.prototype.normalize()`

**Character Counting**:

- Use **grapheme clusters** (visible characters) not byte/code point length
- Go: `utf8.RuneCountInString()`
- Python: `len(str)` (already counts graphemes)
- TypeScript: `[...str].length` or grapheme segmentation library

### Testing Requirements

Each helper library MUST:

1. **Pass all shared fixtures** from `config/library/foundry/similarity-fixtures.yaml`
2. **Benchmark against targets** and document results in library-specific docs
3. **Property-based tests** (if framework available):
   - `Distance(a, a) == 0` (identity)
   - `Distance(a, b) == Distance(b, a)` (symmetry)
   - `Distance(a, c) <= Distance(a, b) + Distance(b, c)` (triangle inequality)
   - `Score(a, b) in [0.0, 1.0]` (range bounds)

## Integration Examples

### Crucible Shim Error Messages

```python
# pyfulmen example
from fulmen.foundry import similarity
from fulmen.crucible_shim import AssetNotFoundError

def get_asset(asset_id: str) -> Asset:
    try:
        return shim.read_asset(asset_id)
    except AssetNotFoundError:
        candidates = shim.list_assets()
        suggestions = similarity.suggest(
            asset_id,
            [c.id for c in candidates],
            min_score=0.6,
            max_suggestions=3
        )

        if suggestions:
            hint = f"Did you mean: {', '.join(s.value for s in suggestions)}?"
            raise AssetNotFoundError(f"Asset '{asset_id}' not found. {hint}")
        else:
            raise
```

### Docscribe Document Search

```typescript
// tsfulmen example
import { similarity } from "@fulmen/foundry";
import { docscribe } from "@fulmen/docscribe";

function findDocument(query: string): Document | null {
  const docs = docscribe.listDocuments();

  const suggestions = similarity.suggest(
    query,
    docs.map((d) => d.title),
    {
      minScore: 0.5,
      maxSuggestions: 5,
      normalize: true,
    },
  );

  return suggestions.length > 0
    ? docs.find((d) => d.title === suggestions[0].value)
    : null;
}
```

### CLI Command Suggestions

```go
// gofulmen example
import (
    "github.com/fulmenhq/gofulmen/foundry/similarity"
)

func SuggestCommand(input string, commands []string) {
    suggestions := similarity.Suggest(input, commands, similarity.SuggestOptions{
        MinScore:       0.6,
        MaxSuggestions: 3,
        Normalize:      true,
    })

    if len(suggestions) > 0 {
        fmt.Printf("Unknown command '%s'. Did you mean:\n", input)
        for _, s := range suggestions {
            fmt.Printf("  - %s (%.0f%% match)\n", s.Value, s.Score*100)
        }
    }
}
```

## Module Manifest Entry

The Foundry module entry in `config/library/v1.0.0/module-manifest.yaml` documents similarity capabilities:

```yaml
- id: foundry
  tier: core
  requirement: mandatory
  description: >
    Common reference data, patterns, and text utilities including similarity
    scoring and normalization for fuzzy matching and suggestions.
  capabilities:
    - country_codes
    - http_statuses
    - mime_types
    - patterns
    - text_similarity
    - text_normalization
  coverage:
    - language: go
      target: 95
    - language: python
      target: 95
    - language: typescript
      target: 95
```

## Versioning & Evolution

**Current Version**: 1.0.0 (2025.10.2)

**Stability Promise**:

- API signatures stable for v1.x
- Fixture format backward compatible
- Performance targets may tighten in minor versions

**Future Enhancements** (post-2025.10.2):

- Damerau-Levenshtein distance (transpositions)
- Jaro-Winkler similarity (prefix-weighted)
- Configurable edit costs (insertion/deletion/substitution)
- Phonetic matching (Soundex, Metaphone)

## References

- [Levenshtein Distance (Wikipedia)](https://en.wikipedia.org/wiki/Levenshtein_distance)
- [Wagner-Fischer Algorithm](https://en.wikipedia.org/wiki/Wagner%E2%80%93Fischer_algorithm)
- [Unicode Normalization Forms](https://unicode.org/reports/tr15/)
- [Unicode Case Folding](https://www.unicode.org/reports/tr21/tr21-5.html)
- Shared Fixtures: `config/library/foundry/similarity-fixtures.yaml`
- Fixture Schema: `schemas/library/foundry/v1.0.0/similarity.schema.json`

---

**Conformance**: This standard is part of the Fulmen Helper Library Standard (2025.10.2) and synchronizes to all language wrappers.
