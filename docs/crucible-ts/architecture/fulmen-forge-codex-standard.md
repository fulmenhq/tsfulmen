---
title: "Fulmen Forge Codex Standard"
description: "Standard architecture and capabilities for Fulmen Codex forges – documentation-first templates for canonical knowledge bases"
author: "Fulmen Enterprise Architect (@fulmen-ea-steward)"
date: "2025-10-31"
last_updated: "2025-10-31"
status: "draft"
tags: ["architecture", "forge", "codex", "template", "2025.10.3"]
---

# Fulmen Forge Codex Standard

Codex forges are Fulmen’s documentation-first starters: opinionated static sites that deliver production-grade knowledge hubs for internal and external audiences. They map to the `codex` repository category from the [Repository Category Taxonomy](../../config/taxonomy/repository-categories.yaml) and embody the “rapid build in public” philosophy—start fast with a pre-integrated doc stack, then scale into multi-product portals without replatforming. This standard complements the [Fulmen Forge Workhorse Standard](fulmen-forge-workhorse-standard.md) and provides the architectural contract every codex forge must satisfy.

## Scope

Applies to repositories named `fulmen-codex-forge-*` and downstream forks derived via CDRL (Clone → Degit → Refit → Launch). Codex forges target documentation portals, schema registries, reference manuals, and developer hubs. They are **not** generic marketing sites; compliance requires integration with Fulmen helper tooling, schema governance, and publishing automation.

## Tooling Baseline

| Layer                     | Standard Requirement                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| Static Site Generator     | **Preferred:** Astro 5.x with the Starlight docs theme<sup>†</sup>    |
| Runtime / Package Tooling | **Bun ≥ 1.2** (primary), `pnpm` fallback for legacy CI                |
| Node.js Compatibility     | Node.js ≥ 20.10 LTS (Bun runtime handles most scripts)                |
| Styling                   | **Tailwind CSS** with Fulmen preset (`tailwind.config.fulmen.cjs`)    |
| Icons                     | Astro Icon + Iconify (build-time optimized sprite bundle)             |
| Fonts                     | Inter (UI), JetBrains Mono (code); served via local WOFF2 assets      |
| MDX                       | Enabled with `remark*` / `rehype*` plugins (syntax highlighting, TOC) |
| Testing                   | Vitest + Playwright, axe-core accessibility checks, linkinator        |
| CI/CD                     | GitHub Actions template (`.github/workflows/codex.yml`)               |
| Optional DX               | `astro dev` fast-refresh, `pnpm lint` (ESLint + Stylelint)            |

> **CSS Guidance:** Codex forges MUST ship Tailwind CSS. Utility classes simplify theming while the preset enforces Fulmen typography, spacing, and color scales. Avoid ad-hoc global CSS except for print styles or component overrides.

<sup>†</sup>Astro/Starlight remains the blessed baseline. Alternative static site generators are permitted when they satisfy the [Technology Selection Criteria](#technology-selection-criteria) and still fulfil every pillar in this standard.

## Technology Selection Criteria

Teams may propose an alternative toolchain when Astro/Starlight is unsuitable for the problem space. Any exception request MUST document how the chosen stack:

1. Demonstrates compliance with all [Seven Pillars of a Codex Forge](#seven-pillars-of-a-codex-forge), including lighthouse benchmarks and governance hooks.
2. Runs comfortably within the Bun ≥ 1.2 / Node ≥ 20.10 toolchain and can execute the reference Makefile + GitHub Actions workflow without bespoke build servers.
3. Integrates with Fulmen helper libraries (`tsfulmen` today, additional languages as they mature) or ships an equivalent bridge so Crucible assets remain the SSOT.
4. Provides a pluggable MDX/Markdown authoring experience with syntax extensions, component slots, and remark/rehype equivalents sufficient to represent Fulmen documentation patterns.
5. Exposes deterministic build artefacts compatible with the repository’s sync scripts (e.g., schema ingestion, recipe generation) and honours the same accessibility and testing gates.
6. Documents long-term maintenance, including upgrade cadence, security patch strategy, and fallback should the upstream project become inactive.

Exception requests require Architecture Committee sign-off and MUST include a rollback plan. Approved alternatives are recorded in `docs/architecture/changelog.md`.

## Static Site Classification

Codex investments now span multiple tiers of complexity. Categorising a project up front clarifies expectations and ensures the appropriate standard applies.

- **Codex Forge (Full Experience)** – Comprehensive documentation hubs or knowledge portals. Must satisfy this entire standard and ship the Seven Pillars end to end (e.g., future `fulmen-codex-forge-aurora`).
- **Codex Registry** – Schema-heavy sites such as the forthcoming Fulmen/specomate registry. Still adhere to this standard, but content ingestion recipes and schema surfacing take priority over marketing surfaces.
- **Headless Utility Registry** – Minimal static exports (for example `ppgate`) that primarily serve machine-readable data or redirects. These MAY omit portions of the forge standard, but MUST document which pillars are intentionally deferred and provide an upgrade path when evolving into a full codex.

Whenever a repository graduates from “utility registry” to a “codex registry” or full forge, the maintainers must update `.plans/` with the migration strategy and rerun architecture review.

> **Helper Libraries:** Codex forges MUST depend on the language-specific Fulmen helper library (e.g., `tsfulmen` for TypeScript) and expose all Crucible assets via helper APIs rather than bundling raw schema/config copies. Helper library updates should be pinned via lockfiles and surfaced in release notes.

> **Crucible References:** This standard augments the global [Makefile Standard](../standards/makefile-standard.md); any additional codex targets MUST be additive. When helper libraries provide Crucible passthroughs (for example, gofulmen—see `forge-workhorse-groningen/docs/development/accessing-crucible-docs-via-gofulmen.md`), codex forges MUST follow the same pattern rather than embedding duplicate docs. A tsfulmen-access guide will mirror the gofulmen example and should be linked once published.

## Seven Pillars of a Codex Forge

Codex forges SHALL adhere to the “seven pillars” distilled by the Architecture Committee. Each pillar lists minimum requirements; additional features may graduate the forge to higher maturity levels.

### Pillar I – Lightning-Fast Performance

1. Static-first architecture (Astro build) with progressive enhancement—content must remain accessible when JavaScript is disabled.
2. Automated asset optimisation: image compression via `@astrojs/image`, font subsetting, CSS critical path extraction.
3. Edge/CDN friendly output: hashed assets, cache headers, and 200/404 fallbacks.
4. Lighthouse benchmarks (Performance/Accessibility/Best Practices/SEO ≥ 95; CLS < 0.1; FCP < 1s).

### Pillar II – Enterprise Content Architecture

1. Hierarchical navigation with autogenerated sidebar, breadcrumbs, and section-aware search (Algolia DocSearch or Starlight’s local index).
2. Versioned content: `/docs/[version]/` routes, changelog callouts, deprecated banners.
3. Content federation hooks: ingestion scripts that pull docs from upstream repositories while preserving source attribution.
4. CI validation: broken link detector, markdown lint, embedded code sample checks.

### Pillar III – Developer Experience Excellence

1. MDX-first authoring with component catalog (`src/components/mdx/`), hot reload, and error overlays.
2. Rich code examples: syntax highlighting, line numbers, copy buttons, diff blocks, terminal renders.
3. Automated API/spec documentation (OpenAPI, AsyncAPI, GraphQL) via Astro integrations or build scripts.
4. Local dev “one command start”: `pnpm install && pnpm dev` must work cross-platform.

### Pillar IV – Accessibility & Internationalisation

1. WCAG 2.1 AA compliance—semantic HTML, ARIA roles, focus management, pa11y/axe CI gate.
2. i18n infrastructure with locale routing (`/en/`, `/es/`, etc.), translation pipeline, RTL support.
3. Responsive design tested on mobile/tablet/desktop; screenshot diffs tracked via Playwright.
4. Optional offline mode via Astro’s PWA integration when the use case demands offline docs.

### Pillar V – Opinionated Design System

1. Tailwind preset providing Fulmen tokens (colors, spacing, typography, shadows).
2. Theme switcher (light/dark) persisted via CSS variables + local storage.
3. Modular layout primitives: hero blocks, cards, callouts, tabbed code blocks, timeline components.
4. Icon strategy: Iconify-based `<CodexIcon>` component with lazy loading and sprite bundling.

### Pillar VI – Operational Excellence

1. Makefile targets: `bootstrap`, `dev`, `build`, `lint`, `test`, `preview`, `deploy`.
2. Blueprint deployment recipes (Netlify, Cloudflare Pages, AWS S3 + CloudFront) with parameterised secrets (no secrets in repo).
3. Observability: optional Plausible/Umami analytics integration, Core Web Vitals monitoring instructions.
4. Release playbook: CalVer tagging, changelog in `release-notes/`, automated preview URLs on PRs.

### Pillar VII – Governance & Extensibility

1. Content provenance—frontmatter must record `source_repo`, `source_path`, `synced_at`.
2. Extension kit—codex forges MUST document how plugins, data ingestion adapters, and MDX shortcodes register with the build. Provide:
   - A canonical extension entry point (e.g., `src/plugins/{type}/index.ts`) with lifecycle hooks for pre-build, build, and post-build phases.
   - Sample scaffolds plus testing guidance so downstream teams can author plugins without reverse engineering the template.
   - Versioned compatibility notes describing which plugin APIs are stable, experimental, or scheduled for deprecation.
3. Compatibility matrix: README table listing tested Node versions, browsers, deployment targets, and supported plugin API versions.
4. Governance guardrails: document approval workflow for third-party extensions, security scanning expectations, and rollback steps when disabling a plugin.
5. Anti-pattern guardrails: no JS-required rendering, no third-party trackers without opt-in, no vendor lock-in.

## Minimum Viable Codex (Level 1)

A template is considered Level 1 compliant when it satisfies:

- Astro/Starlight skeleton with Tailwind preset, Inter/JetBrains fonts.
- Single-locale documentation with hierarchical nav + search, responsive design, Lighthouse ≥ 95.
- MDX pipeline with code highlighting and copy buttons.
- Makefile + CI workflow (lint, test, build).
- Deployment recipe for at least one target (Netlify or Cloudflare Pages).

Higher maturity (Levels 2–5) introduces versioned docs, federated content, AI assistants, analytics, etc., as per the committee guidance.

## Repository & File Structure

```
/
├── astro.config.mjs
├── package.json
├── pnpm-lock.yaml
├── bun.lockb
├── bunfig.toml
├── Makefile
├── tailwind.config.fulmen.cjs        # Shared preset import
├── src/
│   ├── content/                      # MDX/collections (Starlight content layer)
│   ├── components/                   # Reusable Astro/React/Vue islands
│   ├── layouts/                      # Page shells (docs, landing, schema view)
│   └── scripts/                      # Build-time ingestion (schemas, API specs)
├── public/                           # Static assets (favicons, fonts, schema downloads)
├── docs/                             # Meta documentation (architecture, contribution guides)
├── recipes/                          # Deployment runbooks (YAML/Markdown)
├── scripts/                          # Node scripts (schema sync, link check)
└── .github/workflows/codex.yml       # CI pipeline
```

## Documentation Requirements

1. **README.md** – quick start (≤5 minutes to deploy), architecture summary, compatibility matrix.
2. **docs/architecture/** – explain ingestion pipeline, component catalog, theming strategy.
3. **docs/content/** – authoring guide (frontmatter schema, MDX components, translation workflow).
4. **docs/operations/** – deployment recipes, release checklist, analytics integration.
5. **docs/contributing.md** – coding standards, linting, testing, semantic commits.
6. **docs/crucible-integration.md** – instructions for consuming Crucible assets via helper libraries (link to helper-specific docs such as the gofulmen access guide until tsfulmen analogue is published).

All Markdown files must include YAML frontmatter (see [Frontmatter Standard](../standards/frontmatter-standard.md)).

## Testing & Quality Gates

- `bun lint` / `pnpm lint` – ESLint + Stylelint (Bun preferred, pnpm fallback).
- `bun test` / `pnpm test` – Vitest unit tests for Astro components/utilities.
- `bun test:e2e` / `pnpm test:e2e` – Playwright smoke tests (navigation, search, theme toggle).
- `bun test:accessibility` – axe-core or pa11y run.
- `bun test:links` – linkinator or similar for broken link detection.
- Optional: Percy/Chromatic visual regression where design stability matters.

CI MUST enforce these gates before merge. Build time for reference template should stay under 60 seconds for 1,000 MDX pages (baseline metric).

## Integration with Other Ecosystem Pieces

- **Schema Hosting**: Codex forges hosting schema catalogs (e.g., `schemas.fulmenhq.dev`) must integrate with Crucible or specomate sync scripts to ingest JSON Schema, OpenAPI, AsyncAPI artefacts. Expose canonical download URLs under `public/schemas/` and document provenance in frontmatter.
- **ppgate**: Optional handoff—ppgate can manage vanity redirects (`schemas.fulmenhq.dev` → codex deployment). Codex forges should provide machine-readable manifests (JSON feed) that ppgate can ingest.
- **Helper libraries**: Codex forges built with TypeScript MUST depend on `tsfulmen` (minimum version matching the forge’s CalVer) for config access, logging adapters, and Crucible shims; avoid duplicating helper functionality in-repo.
- **Configuration & Standards**: Honour the [Three-Layer Configuration Standard](../standards/configuration-standardization.md) and [Configuration Path API](../standards/library/modules/config-path-api.md) via helper libraries rather than custom loaders. Cross-reference Crucible docs directly instead of copying (see `forge-workhorse-groningen/docs/development/accessing-crucible-docs-via-gofulmen.md` for the canonical pattern).

## Anti-Patterns

- Server-side runtimes (Next.js SSR) for core docs.
- Embedding dynamic SPA frameworks without fallback content.
- Hardcoding secrets or analytics tokens.
- Manually managed navigation (no auto-generated TOC).
- Proprietary doc formats lacking export plan.

## Implementation Roadmap

1. Publish this standard and circulate to Architecture Committee for ratification.
2. Publish helper-library access documentation for TypeScript (`tsfulmen`) analogous to the gofulmen guide cited above.
3. Draft `.plans/active/modules/schema-registry-bootstrap.md` describing the initial codex project (Fulmen schema registry / specomate registry).
4. Implement reference forge `fulmen-codex-forge-aurora` (Level 2 target: multi-version, schema ingestion, i18n-ready).
5. Add CI template (`.github/workflows/codex.yml`) to Crucible for reuse.
6. Coordinate with ppgate maintainers for optional vanity routing integration.

## Change Management

- Changes to this standard follow the architecture RFC process. Update `last_updated` and document rationale in `docs/architecture/changelog.md`.
- Codex forges must track CalVer versions in `VERSION` and note lifecycle phase (alpha/beta/stable) using `LIFECYCLE_PHASE`.

## References

- [Fulmen Ecosystem Guide](fulmen-ecosystem-guide.md)
- [Fulmen Forge Workhorse Standard](fulmen-forge-workhorse-standard.md)
- [Repository Category Taxonomy](../../config/taxonomy/repository-categories.yaml)
- [Frontmatter Standard](../standards/frontmatter-standard.md)
- [Fulmen Technical Manifesto](fulmen-technical-manifesto.md)

---

**Status:** Draft – pending Architecture Committee ratification  
**Reviewers:** @schema-cartographer, @pipeline-architect, @ppgate-core  
**Next Review:** 2025-11-15
