# TSFulmen Makefile
# Compliant with FulmenHQ Makefile Standard
# Quick Start Commands:
#   make help           - Show all available commands
#   make bootstrap      - Install dependencies and external tools
#   make test           - Run tests
#   make build          - Build distributable artifacts
#   make check-all      - Full quality check (lint, typecheck, test)

# Variables
VERSION := $(shell cat VERSION 2>/dev/null || echo "0.1.0")

# External tooling (bootstrap)
# Defaults to $HOME/.local/bin on macOS/Linux
BINDIR ?= $(HOME)/.local/bin
GONEAT_VERSION ?= v0.4.4
SFETCH_INSTALL_URL ?= https://github.com/3leaps/sfetch/releases/latest/download/install-sfetch.sh

.PHONY: all help bootstrap bootstrap-force build-local sync-ssot tools sync lint fmt test build build-all clean version version-set version-sync
.PHONY: version-bump-major version-bump-minor version-bump-patch version-bump-calver license-audit
.PHONY: release-check release-prepare release-build typecheck check-all quality precommit prepush test-watch test-coverage
.PHONY: verify-schema-export validate-app-identity verify-app-identity-parity validate-signals verify-signals-parity
.PHONY: verify-artifacts verify-local-install verify-published-package adr-validate adr-new

# Default target
all: check-all

# Help target
help: ## Show this help message
	@echo "TSFulmen - TypeScript Fulmen Helper Library"
	@echo ""
	@echo "Required targets (Makefile Standard):"
	@echo "  help            - Show this help message"
	@echo "  bootstrap       - Install dependencies and external tools"
	@echo "  bootstrap-force - Force reinstall all tools (or use: make bootstrap FORCE=1)"
	@echo "  build-local     - Build local CLI for development"
	@echo "  sync-ssot       - Sync assets from Crucible SSOT"
	@echo "  tools           - Verify external tools are available"
	@echo "  lint            - Run linting checks (Biome for TS/JS, goneat for YAML/JSON/MD)"
	@echo "  test            - Run all tests"
	@echo "  build           - Build distributable artifacts"
	@echo "  build-all       - Build multi-platform binaries (N/A for library)"
	@echo "  clean           - Remove build artifacts and caches"
	@echo "  fmt             - Format code"
	@echo "  version         - Print current version"
	@echo "  version-set     - Update VERSION and sync metadata"
	@echo "  version-bump-*  - Bump version (major/minor/patch/calver)"
	@echo "  check-all       - Run all quality checks"
	@echo "  quality         - Run lint, typecheck, tests, and build"
	@echo "  precommit       - Run pre-commit hooks (fmt, lint, typecheck)"
	@echo "  prepush         - Run pre-push hooks (check-all)"
	@echo "  release-check   - Validate release readiness"
	@echo "  release-prepare - Prepare for release"
	@echo "  release-build   - Build release artifacts"
	@echo ""
	@echo "Additional targets:"
	@echo "  typecheck       - Run TypeScript type checking"
	@echo "  test-watch      - Run tests in watch mode"
	@echo "  test-coverage   - Run tests with coverage report"
	@echo "  license-audit   - Audit dependencies for forbidden licenses"
	@echo "  adr-validate    - Validate local ADR frontmatter and filenames"
	@echo "  adr-new         - Create new local ADR from template"
	@echo ""

# Goneat resolution (finds goneat in BINDIR or PATH)
GONEAT_RESOLVE = \
	GONEAT=""; \
	if [ -x "$(BINDIR)/goneat" ]; then GONEAT="$(BINDIR)/goneat"; fi; \
	if [ -z "$$GONEAT" ]; then GONEAT="$$(command -v goneat 2>/dev/null || true)"; fi; \
	if [ -z "$$GONEAT" ]; then echo "goneat not found. Run 'make bootstrap' first."; exit 1; fi

# Sfetch resolution (finds sfetch in BINDIR or PATH)
SFETCH_RESOLVE = \
	SFETCH=""; \
	if [ -x "$(BINDIR)/sfetch" ]; then SFETCH="$(BINDIR)/sfetch"; fi; \
	if [ -z "$$SFETCH" ]; then SFETCH="$$(command -v sfetch 2>/dev/null || true)"; fi

# Bootstrap targets (sfetch -> goneat trust pyramid)
# Inlined for consistency with rsfulmen - no separate script to maintain.
# GITHUB_TOKEN: Set this env var in CI to avoid GitHub API rate limits.
bootstrap: ## Install external tools (sfetch, goneat + foundation tools)
	@echo "Bootstrapping tsfulmen development environment..."
	@mkdir -p "$(BINDIR)"
	@echo ""
	@echo "Step 1: Installing sfetch (trust anchor)..."
	@if ! command -v sfetch >/dev/null 2>&1 && [ ! -x "$(BINDIR)/sfetch" ]; then \
		echo "-> Installing sfetch into $(BINDIR)..."; \
		if [ -n "$$GITHUB_TOKEN" ]; then \
			echo "   (using GITHUB_TOKEN for authenticated request)"; \
			curl -H "Authorization: token $$GITHUB_TOKEN" -sSfL "$(SFETCH_INSTALL_URL)" | bash -s -- --dir "$(BINDIR)" --yes; \
		elif command -v curl >/dev/null 2>&1; then \
			curl -sSfL "$(SFETCH_INSTALL_URL)" | bash -s -- --dir "$(BINDIR)" --yes; \
		elif command -v wget >/dev/null 2>&1; then \
			wget -qO- "$(SFETCH_INSTALL_URL)" | bash -s -- --dir "$(BINDIR)" --yes; \
		else \
			echo "curl or wget required to bootstrap sfetch" >&2; \
			exit 1; \
		fi; \
	else \
		echo "-> sfetch already installed"; \
	fi
	@echo ""
	@echo "Step 2: Installing goneat via sfetch..."
	@SFETCH_BIN="$$(command -v sfetch 2>/dev/null || true)"; \
	if [ -z "$$SFETCH_BIN" ] && [ -x "$(BINDIR)/sfetch" ]; then SFETCH_BIN="$(BINDIR)/sfetch"; fi; \
	if [ -z "$$SFETCH_BIN" ]; then echo "sfetch not found after bootstrap" >&2; exit 1; fi; \
	if [ "$(FORCE)" = "1" ] || [ "$(FORCE)" = "true" ]; then \
		echo "-> Force installing goneat $(GONEAT_VERSION) into $(BINDIR)..."; \
		"$$SFETCH_BIN" -repo fulmenhq/goneat -tag "$(GONEAT_VERSION)" -dest-dir "$(BINDIR)"; \
	else \
		if ! command -v goneat >/dev/null 2>&1 && [ ! -x "$(BINDIR)/goneat" ]; then \
			echo "-> Installing goneat $(GONEAT_VERSION) into $(BINDIR)..."; \
			"$$SFETCH_BIN" -repo fulmenhq/goneat -tag "$(GONEAT_VERSION)" -dest-dir "$(BINDIR)"; \
		else \
			echo "-> goneat already installed: $$(goneat version 2>&1 | head -1 || $(BINDIR)/goneat version 2>&1 | head -1)"; \
		fi; \
	fi
	@echo ""
	@echo "Step 3: Installing foundation tools via goneat..."
	@GONEAT_BIN="$$(command -v goneat 2>/dev/null || true)"; \
	if [ -z "$$GONEAT_BIN" ] && [ -x "$(BINDIR)/goneat" ]; then GONEAT_BIN="$(BINDIR)/goneat"; fi; \
	if [ -n "$$GONEAT_BIN" ]; then \
		"$$GONEAT_BIN" doctor tools --scope foundation --install --yes --no-cooling 2>/dev/null || \
		echo "-> Some foundation tools may need manual installation"; \
	fi
	@echo ""
	@echo "Step 4: Syncing Bun dependencies..."
	@if command -v bun >/dev/null 2>&1; then \
		bun install; \
		echo "-> Bun dependencies synced"; \
	else \
		echo "bun not found - install from https://bun.sh" >&2; \
		exit 1; \
	fi
	@echo ""
	@echo "Bootstrap completed."
	@echo "Ensure '$(BINDIR)' is on PATH: export PATH=\"$(BINDIR):\$$PATH\""

bootstrap-force: ## Force reinstall external tools
	@$(MAKE) bootstrap FORCE=1

build-local: ## Build local development artifacts
	@echo "Building local artifacts..."
	@bun run build
	@echo "✅ Local build complete"

sync-ssot: ## Sync assets from Crucible SSOT
	@echo "Syncing assets from Crucible..."
	@$(GONEAT_RESOLVE); $$GONEAT ssot sync --force-remote
	@echo "✅ Sync completed"

# Legacy alias for compatibility
sync: sync-ssot

version-sync: version-propagate ## Legacy alias for version-propagate

tools: ## Verify external tools are available
	@echo "Verifying external tools..."
	@$(SFETCH_RESOLVE); if [ -n "$$SFETCH" ]; then echo "sfetch: $$("$$SFETCH" -version 2>&1 | head -n1)"; else echo "sfetch not found (optional for day-to-day)"; fi
	@$(GONEAT_RESOLVE); echo "goneat: $$($$GONEAT --version 2>&1 | head -n1 || true)"
	@bun --version > /dev/null && echo "bun: $$(bun --version)" || (echo "bun not found" && exit 1)
	@echo "All required tools verified"

# Version management
version: ## Print current version
	@echo "$(VERSION)"

version-set: ## Update VERSION (usage: make version-set VERSION=x.y.z)
	@test -n "$(VERSION)" || (echo "VERSION not set. Use: make version-set VERSION=x.y.z" && exit 1)
	@$(GONEAT_RESOLVE); $$GONEAT version set $(VERSION)
	@$(MAKE) version-propagate
	@echo "Version set to $(VERSION) and propagated"

version-propagate: ## Propagate VERSION to package managers (package.json, etc.)
	@$(GONEAT_RESOLVE); $$GONEAT version propagate
	@bunx tsx scripts/propagate-version-additional.ts
	@echo "Version propagated to package managers and source files"

version-bump-major: ## Bump major version
	@$(GONEAT_RESOLVE); $$GONEAT version bump major
	@$(MAKE) version-propagate
	@echo "Version bumped (major) and propagated"

version-bump-minor: ## Bump minor version
	@$(GONEAT_RESOLVE); $$GONEAT version bump minor
	@$(MAKE) version-propagate
	@echo "Version bumped (minor) and propagated"

version-bump-patch: ## Bump patch version
	@$(GONEAT_RESOLVE); $$GONEAT version bump patch
	@$(MAKE) version-propagate
	@echo "Version bumped (patch) and propagated"

version-bump-calver: ## Bump to CalVer (YYYY.0M.MICRO)
	@$(GONEAT_RESOLVE); $$GONEAT version bump calver
	@$(MAKE) version-propagate
	@echo "Version bumped (calver) and propagated"

# Quality targets
lint: ## Run linting checks
	@echo "Linting TypeScript/JavaScript..."
	@bunx biome check --no-errors-on-unmatched src/
	@echo "Assessing YAML/JSON/Markdown..."
	@$(GONEAT_RESOLVE); $$GONEAT assess --categories format,lint --check
	@echo "All linting passed"

fmt: ## Format code
	@echo "Formatting TypeScript/JavaScript..."
	@bunx biome check --write src/
	@echo "Formatting docs and config (goneat)..."
	@$(GONEAT_RESOLVE); bash -c '$$GONEAT format --types yaml,json,markdown --folders . --finalize-eof --quiet 2>&1 | grep -v -E "(fixtures/invalid|encountered the following formatting errors)" || true'
	@echo "All files formatted"

typecheck: ## Run TypeScript type checking
	@echo "Type checking with tsc..."
	@bunx tsc --noEmit
	@echo "✅ Type checking passed"

test: ## Run all tests
	@echo "Running test suite..."
	@bunx vitest run

test-watch: ## Run tests in watch mode
	@echo "Running tests in watch mode..."
	@bunx vitest

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	@bunx vitest run --coverage

verify-schema-export: ## Verify schema export parity against runtime registry
	@echo "Verifying schema export parity..."
	@bunx tsx scripts/verify-schema-export.ts

validate-app-identity: ## Validate .fulmen/app.yaml against schema
	@echo "Validating application identity..."
	@bun run src/schema/cli.ts identity-validate
	@echo "✅ Identity validation passed"

verify-app-identity-parity: ## Verify identity parity with Crucible snapshot
	@bun scripts/verify-app-identity.ts

validate-signals: ## Validate signal catalog and configuration
	@echo "Validating signal catalog..."
	@bun run src/foundry/signals/cli.ts platform
	@echo "✅ Signal catalog validation passed"

verify-signals-parity: ## Verify signals parity with Crucible snapshot
	@bun scripts/verify-signals-parity.ts

check-all: lint typecheck test license-audit verify-schema-export verify-app-identity-parity verify-signals-parity ## Run all quality checks
	@echo "All quality checks passed"

quality: build check-all ## Run build, lint, typecheck, tests, and verification
	@echo "Quality checks complete"

# License compliance
license-audit: ## Audit dependencies for forbidden licenses
	@echo "Auditing dependency licenses..."
	@mkdir -p dist/reports
	@bunx license-checker --csv --out dist/reports/license-inventory.csv 2>/dev/null || \
		(bun add -D license-checker && bunx license-checker --csv --out dist/reports/license-inventory.csv)
	@forbidden='GPL|LGPL|AGPL|MPL|CDDL'; \
	if grep -E "$$forbidden" dist/reports/license-inventory.csv >/dev/null 2>&1; then \
		echo "Forbidden license detected. See dist/reports/license-inventory.csv"; \
		grep -E "$$forbidden" dist/reports/license-inventory.csv; \
		exit 1; \
	else \
		echo "No forbidden licenses detected"; \
	fi

# Build targets
build: ## Build distributable artifacts
	@echo "Building distributable artifacts..."
	@bunx tsup --config tsup.config.ts
	@echo "✅ Build complete"

build-all: ## Build multi-platform binaries (N/A for library)
	@echo "⚠️  TSFulmen is a library - no platform-specific binaries to produce"
	@echo "✅ Build target satisfied (delegates to 'build')"
	$(MAKE) build

# Release targets
release-check: check-all ## Validate release readiness
	@echo "Running release validation..."
	@if [ ! -f VERSION ]; then echo "❌ VERSION file missing"; exit 1; fi
	@if [ ! -f CHANGELOG.md ]; then echo "⚠️  CHANGELOG.md missing (recommended)"; fi
	@echo "✅ Release checks passed"

release-prepare: check-all ## Prepare for release
	@echo "Preparing release..."
	$(MAKE) version-sync
	@echo "✅ Release prepared"

release-build: build-all ## Build release artifacts (delegates to build-all for libraries)
	@echo "Building release artifacts..."
	@echo "✅ Release artifacts ready in dist/"

# Package validation targets
.PHONY: validate-exports validate-tsup validate-source-modules validate-package validate-imports validate-types validate-all
validate-exports:
	@echo "🔍 Validating package.json exports..."
	@bunx tsx scripts/validate-exports.ts
validate-tsup:
	@echo "🔍 Validating tsup configuration..."
	@bunx tsx scripts/validate-tsup-config.ts
validate-source-modules:
	@echo "🔍 Validating source module mapping..."
	@bunx tsx scripts/validate-source-modules.ts
validate-package:
	@echo "🔍 Validating package contents..."
	@bunx tsx scripts/validate-package-contents.ts
validate-imports:
	@echo "🔍 Validating consumer imports..."
	@bunx tsx scripts/validate-imports.ts
validate-types:
	@echo "🔍 Validating type declarations..."
	@bunx tsx scripts/validate-types.ts
validate-all: validate-exports validate-tsup validate-source-modules validate-package validate-imports validate-types
	@echo "✅ All package integrity validations passed"

# Hook targets
precommit: fmt lint typecheck ## Run pre-commit hooks (format, lint, typecheck)
	@echo "Running goneat pre-commit assessment..."
	@$(GONEAT_RESOLVE); $$GONEAT assess --hook pre-commit --hook-manifest .goneat/hooks.yaml
	@echo "Pre-commit hooks passed"

prepush: check-all ## Run pre-push hooks (comprehensive quality checks)
	@echo "Running goneat pre-push assessment..."
	@$(GONEAT_RESOLVE); $$GONEAT assess --hook pre-push --hook-manifest .goneat/hooks.yaml
	@echo "Pre-push checks passed"

# Clean targets
clean: ## Clean build artifacts and reports
	@echo "Cleaning artifacts..."
	@rm -rf dist coverage bin assets package
	@rm -f *.tgz SHA256SUMS SHA512SUMS
	@echo "✅ Clean complete"

clean-full: clean ## Full clean (including node_modules)
	@echo "Full clean (including node_modules)..."
	@rm -rf node_modules bun.lockb
	@echo "✅ Full clean complete"

# ADR management targets
adr-validate: ## Validate local ADR frontmatter and filenames
	@echo "Validating ADRs..."
	@if [ ! -d docs/development/adr ]; then \
		echo "✅ No local ADRs to validate yet"; \
		exit 0; \
	fi
	@ADR_COUNT=$$(ls docs/development/adr/ADR-*.md 2>/dev/null | wc -l | tr -d ' '); \
	if [ "$$ADR_COUNT" -eq 0 ]; then \
		echo "✅ No local ADRs to validate yet"; \
		exit 0; \
	fi; \
	echo "Found $$ADR_COUNT local ADR(s) to validate"; \
	bunx tsx scripts/validate-adrs.ts

adr-new: ## Create new local ADR from template
	@if [ ! -f docs/crucible-ts/architecture/decisions/template.md ]; then \
		echo "❌ ADR template not found. Run 'make sync-ssot' first."; \
		exit 1; \
	fi
	@NEXT_ID=$$(ls docs/development/adr/ADR-*.md 2>/dev/null | grep -oE 'ADR-[0-9]{4}' | sort | tail -1 | awk -F'-' '{printf "ADR-%04d", $$2+1}' || echo "ADR-0001"); \
	echo "Creating $$NEXT_ID..."; \
	echo "Enter ADR title (kebab-case, e.g., 'use-proxy-for-lazy-loading'): "; \
	read TITLE; \
	if [ -z "$$TITLE" ]; then \
		echo "❌ Title required"; \
		exit 1; \
	fi; \
	TARGET_FILE="docs/development/adr/$$NEXT_ID-$$TITLE.md"; \
	cp docs/crucible-ts/architecture/decisions/template.md "$$TARGET_FILE" && \
	echo "✅ Created $$TARGET_FILE" && \
	echo "" && \
	echo "Next steps:" && \
	echo "1. Edit $$TARGET_FILE" && \
	echo "2. Update frontmatter: id to '$$NEXT_ID', scope to 'tsfulmen'" && \
	echo "3. Add entry to docs/development/adr/README.md Local ADR Index" && \
	echo "4. Run 'make adr-validate' to verify format"

.PHONY: verify-artifacts
verify-artifacts: ## Verify npm package artifacts before publish
	@echo "Verifying package artifacts..."
	@bunx tsx scripts/verify-package-artifacts.ts
	@echo "✅ Artifact verification complete"

.PHONY: verify-local-install
verify-local-install: ## Verify package works when installed locally (pre-publish test)
	@echo "Running pre-publish local install verification..."
	@bunx tsx scripts/verify-local-install.ts

verify-published-package: build ## Verify published npm package via registry smoke tests
	@TARGET_VERSION="$(if $(strip $(VERIFY_PUBLISH_VERSION)),$(VERIFY_PUBLISH_VERSION),$(VERSION))"; \
		echo "Verifying npm package version $$TARGET_VERSION..."; \
		bunx tsx scripts/verify-published-package.ts $$TARGET_VERSION
	@echo "✅ Published package verification complete"
