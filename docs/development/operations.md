# TSFulmen Development Operations

> **Location**: `docs/development/operations.md` (standardized across all Fulmen helper libraries)

## 🎯 Mission

Enable developers to build enterprise-grade TypeScript/Node.js applications using TSFulmen library with comprehensive support, clear documentation, and reliable tooling.

This document provides operational guidance for TSFulmen maintainers and contributors.

## 📚 Documentation Structure

### Core Documentation

- **`README.md`**: Main project documentation with quick start guide
- **`CHANGELOG.md`**: Version history and migration notes
- **`CONTRIBUTING.md`**: Development guidelines and contribution process
- **`LICENSE`**: MIT License for open source use

### API Documentation

- **`docs/api/`**: Detailed API reference with examples (generated from TSDoc)
- **`docs/guides/`**: Usage guides and tutorials
- **`docs/examples/`**: Code examples and patterns
- **`docs/migration/`**: Upgrade guides between versions

### Architecture Documentation

- **`docs/tsfulmen_overview.md`**: Comprehensive library overview
- **`docs/development/`**: Development operations and guides
- **`docs/crucible-ts/`**: Synced Crucible standards and architecture

## 🛠️ Development Workflow

### Getting Started

```bash
# Clone and setup
git clone https://github.com/fulmenhq/tsfulmen
cd tsfulmen
make bootstrap

# Start development
make sync-ssot
make test
```

### Daily Development

```bash
# Standard development cycle
make fmt             # Format code with Biome
make lint            # Check code quality
make typecheck       # TypeScript type checking
make test            # Run tests with Vitest
make test-watch      # Watch mode for TDD
```

### Quality Assurance

```bash
# Pre-commit checks
make fmt lint typecheck test

# Full quality suite
make check-all       # All quality checks
make test-coverage   # Tests with coverage report
make build           # Verify build succeeds
```

## 🚀 Release Process

### Version Management

- **Semantic Versioning**: Follow MAJOR.MINOR.PATCH for API changes
- **Changelog Maintenance**: Document all changes with impact notes
- **Tagging**: Use Git tags with signed releases
- **GitHub Releases**: Automated with comprehensive release notes

### Release Checklist

```bash
# Complete release preparation
make release-check   # Verify all requirements
make release-prepare # Update docs and sync
make build           # Build distribution
```

### Version Bumping

```bash
make version-bump-patch  # 0.1.0 → 0.1.1
make version-bump-minor  # 0.1.0 → 0.2.0
make version-bump-major  # 0.1.0 → 1.0.0
make version-bump-calver # → YYYY.MM.PATCH
```

## 🔧 Tooling and Commands

### Development Tools

- **Bootstrap**: `make bootstrap` - Install dependencies and goneat
- **Testing**: `make test` - Run Vitest test suite
- **Quality**: `make lint` - Biome code quality checks
- **Building**: `make build` - Create distribution with tsup
- **Type Checking**: `make typecheck` - TypeScript compiler checks

### Make Targets Reference

- **`make help`**: Show all available targets
- **`make clean`**: Remove build artifacts
- **`make sync-ssot`**: Sync Crucible assets via goneat
- **`make tools`**: Verify external tools installed

## 🧪 Testing Strategy

### Test Coverage

- **Unit Tests**: 80%+ coverage on public API
- **Integration Tests**: Cross-module functionality
- **Type Tests**: TypeScript type system validation
- **Compatibility Tests**: Node.js and Bun compatibility

### Quality Gates

- **Code Style**: Biome formatting and linting
- **Type Checking**: TypeScript strict mode compliance
- **Test Coverage**: Vitest with coverage reporting
- **Build Verification**: Successful tsup build

### Testing Tools

```bash
make test              # Run all tests
make test-watch        # Watch mode for TDD
make test-coverage     # Generate coverage report
```

## 📊 Monitoring and Analytics

### Development Metrics

- **Test Coverage**: Track coverage trends over time
- **Bundle Size**: Monitor package size
- **Type Safety**: Track TypeScript strict mode compliance
- **Dependencies**: Monitor for security updates

### Release Analytics

- **Download Stats**: npm download metrics
- **Usage Analytics**: Error reports and telemetry (opt-in)
- **Community Engagement**: GitHub stars, issues, PRs

## 🤝 Community Guidelines

### Contribution Process

1. **Fork Repository**: Create personal fork for development
2. **Create Branch**: Use descriptive branch names
3. **Make Changes**: Implement with tests and documentation
4. **Submit PR**: Pull request with comprehensive description
5. **Code Review**: Address feedback from maintainers
6. **Merge**: Maintainers merge after approval

### Code Standards

- **TypeScript Strict Mode**: Enable all strict type checking
- **Type Annotations**: Explicit types for all public APIs
- **Documentation**: TSDoc comments for all exported functions
- **Testing**: Unit tests for all functionality
- **Error Handling**: Proper error types and messages

### Support Channels

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Mattermost**: `#agents-tsfulmen` for real-time discussion
- **Email**: dave.thompson@3leaps.net for private issues

## 🔐 Security

### Security Process

1. **Vulnerability Reporting**: Private disclosure to maintainers
2. **Security Reviews**: Regular dependency scanning with `bun audit`
3. **Patch Management**: Prioritized security updates
4. **Security Documentation**: Security considerations and best practices

### Dependency Management

- **Regular Updates**: Keep dependencies current
- **Security Scanning**: Automated vulnerability scanning
- **License Compliance**: Verify all dependency licenses
- **Minimal Dependencies**: Zero runtime dependencies (dev only)

### Security Best Practices

```bash
# Audit dependencies
bun audit

# Check for outdated packages
bun outdated

# Update dependencies
bun update
```

## 🏗️ TypeScript-Specific Guidelines

### Build Configuration

- **tsup**: Modern bundler for library builds
- **Dual Exports**: ESM and CJS for compatibility
- **Type Declarations**: Generate `.d.ts` files
- **Source Maps**: Include for debugging

### Type Safety

- **Strict Mode**: All strict flags enabled
- **No `any`**: Avoid `any` types without justification
- **Discriminated Unions**: Use for type-safe configurations
- **Generic Types**: Leverage for extensibility

### Module Structure

```typescript
// ✅ Proper module exports
export { Logger, LoggingProfile } from "./logging";
export type { LoggerConfig, LogContext } from "./logging/types";

// ✅ Barrel exports with re-exports
export * from "./config";
export * from "./crucible";
```

## 🔄 SSOT Sync Operations

### Sync Workflow

```bash
# Sync latest Crucible assets
make sync-ssot

# Verify sync
ls docs/crucible-ts/
ls schemas/crucible-ts/
ls config/crucible-ts/
```

### Sync Configuration

- **Manifest**: `.goneat/ssot-consumer.yaml`
- **Local Override**: `.goneat/ssot-consumer.local.yaml` (gitignored)
- **Sync Path**: `lang/typescript` in Crucible

### Post-Sync Actions

1. Review updated schemas and docs
2. Update module implementations if needed
3. Run tests to ensure compatibility
4. Update planning docs if requirements changed

## 📖 Documentation Generation

### API Documentation

```bash
# Generate TypeDoc documentation
bun run docs:generate

# Preview documentation
bun run docs:serve
```

### Documentation Standards

- **TSDoc Comments**: All public APIs
- **Examples**: Include usage examples
- **Type Information**: Leverage TypeScript types
- **Links**: Cross-reference related APIs

---

_This documentation supports TSFulmen's mission to enable enterprise-grade TypeScript/Node.js development._
