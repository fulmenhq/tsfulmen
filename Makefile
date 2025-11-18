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
BIN_DIR := ./bin

.PHONY: help bootstrap build-local sync-ssot tools sync lint fmt test build build-all clean version version-set version-sync
.PHONY: version-bump-major version-bump-minor version-bump-patch version-bump-calver
.PHONY: release-check release-prepare release-build typecheck check-all quality precommit prepush test-watch test-coverage
.PHONY: verify-schema-export validate-app-identity verify-app-identity-parity validate-signals verify-signals-parity
.PHONY: verify-artifacts verify-local-install adr-validate adr-new

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
	@echo "  adr-validate    - Validate local ADR frontmatter and filenames"
	@echo "  adr-new         - Create new local ADR from template"
	@echo ""

# Bootstrap targets
bootstrap: ## Install dependencies and external tools
	@echo "Installing dependencies..."
	@bun install
	@echo "Installing external tools..."
	@if [ "$(FORCE)" = "1" ] || [ "$(FORCE)" = "true" ]; then \
		bun run scripts/bootstrap-tools.ts --install --verbose --force; \
	else \
		bun run scripts/bootstrap-tools.ts --install --verbose; \
	fi
	@echo "Syncing GitHub templates from oss-policies..."
	@bun run scripts/sync-github-templates.ts || echo "⚠️  GitHub templates sync failed (oss-policies not available)"
	@echo "✅ Bootstrap completed. Use './bin/goneat' or add ./bin to PATH"

bootstrap-force: ## Force reinstall dependencies and external tools
	@$(MAKE) bootstrap FORCE=1

build-local: ## Build local development artifacts
	@echo "Building local artifacts..."
	@bun run build
	@echo "✅ Local build complete"

sync-ssot: ## Sync assets from Crucible SSOT
	@if [ ! -f $(BIN_DIR)/goneat ]; then \
		echo "❌ goneat not found. Run 'make bootstrap' first or set up tools.local.yaml"; \
		exit 1; \
	fi
	@echo "Syncing assets from Crucible..."
	@$(BIN_DIR)/goneat ssot sync --force-remote
	@echo "✅ Sync completed"

# Legacy alias for compatibility
sync: sync-ssot

# Ensure bin/goneat exists for targets that need it
bin/goneat:
	@echo "❌ goneat not found. Run 'make bootstrap' first."
	@exit 1

tools: bin/goneat ## Verify external tools are available
	@echo "Verifying external tools..."
	@$(BIN_DIR)/goneat version > /dev/null && echo "✅ goneat: $$($(BIN_DIR)/goneat version)" || (echo "❌ goneat not functional" && exit 1)
	@bun --version > /dev/null && echo "✅ bun: $$(bun --version)" || (echo "❌ bun not found" && exit 1)
	@echo "✅ All required tools present"

# Version management
version: ## Print current version
	@echo "$(VERSION)"

version-set: bin/goneat ## Update VERSION (usage: make version-set VERSION=x.y.z)
	@test -n "$(VERSION)" || (echo "❌ VERSION not set. Use: make version-set VERSION=x.y.z" && exit 1)
	@$(BIN_DIR)/goneat version set $(VERSION)
	@$(MAKE) version-propagate
	@echo "✓ Version set to $(VERSION) and propagated"

version-propagate: bin/goneat ## Propagate VERSION to package managers (package.json, etc.)
	@$(BIN_DIR)/goneat version propagate
	@bunx tsx scripts/propagate-version-additional.ts
	@echo "✓ Version propagated to package managers and source files"

version-bump-major: bin/goneat ## Bump major version
	@$(BIN_DIR)/goneat version bump major
	@$(MAKE) version-propagate
	@echo "✓ Version bumped (major) and propagated"

version-bump-minor: bin/goneat ## Bump minor version
	@$(BIN_DIR)/goneat version bump minor
	@$(MAKE) version-propagate
	@echo "✓ Version bumped (minor) and propagated"

version-bump-patch: bin/goneat ## Bump patch version
	@$(BIN_DIR)/goneat version bump patch
	@$(MAKE) version-propagate
	@echo "✓ Version bumped (patch) and propagated"

version-bump-calver: bin/goneat ## Bump to CalVer (YYYY.0M.MICRO)
	@$(BIN_DIR)/goneat version bump calver
	@$(MAKE) version-propagate
	@echo "✓ Version bumped (calver) and propagated"

# Quality targets
lint: bin/goneat ## Run linting checks
	@echo "Linting TypeScript/JavaScript..."
	@bunx biome check --no-errors-on-unmatched src/
	@echo "Assessing YAML/JSON/Markdown..."
	@$(BIN_DIR)/goneat assess --categories format,lint --check
	@echo "✅ All linting passed"

fmt: bin/goneat ## Format code
	@echo "Formatting TypeScript/JavaScript..."
	@bunx biome check --write src/
	@echo "Formatting YAML/JSON/Markdown..."
	@$(BIN_DIR)/goneat format --types yaml,json,markdown
	@echo "✅ All files formatted"

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

check-all: lint typecheck test verify-schema-export verify-app-identity-parity verify-signals-parity ## Run all quality checks
	@echo "✅ All quality checks passed"

quality: build check-all ## Run build, lint, typecheck, tests, and verification
	@echo "✅ Quality checks complete"

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
	@echo "✅ Pre-commit checks passed"

prepush: fmt check-all ## Run pre-push hooks (format first, then all quality checks)
	@echo "✅ Pre-push checks passed"

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
