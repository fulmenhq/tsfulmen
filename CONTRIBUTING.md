# Contributing to TSFulmen

Thank you for your interest in contributing to TSFulmen! This TypeScript helper library is part of the FulmenHQ ecosystem, designed for enterprise-grade applications.

## 🌐 Cross-Language Ecosystem Coordination

**Important**: TSFulmen is one of multiple language-specific helper libraries (gofulmen, pyfulmen, tsfulmen) in the Fulmen ecosystem. We prioritize **cross-language consistency** over language-specific features.

### Key Principles

- **Common Elements First**: We focus on implementing functionality that exists across all supported languages (Go, Python, TypeScript)
- **API Parity**: Module interfaces should align with sibling implementations (gofulmen, pyfulmen)
- **Crucible SSOT**: Shared standards, schemas, and specifications live in [Crucible](https://github.com/fulmenhq/crucible/)
- **Coordinated Changes**: Significant API changes should be discussed across language teams

### Language-Specific Provisions

While we coordinate across languages, we do allow TypeScript-specific optimizations:

- **Type Safety**: Leverage TypeScript's type system (discriminated unions, generics, branded types)
- **Developer Experience**: IntelliSense support, builder patterns, ergonomic APIs
- **Platform Features**: ESM/CJS dual exports, Node.js/Bun compatibility
- **Tooling**: TypeScript-native testing, linting, and build tools

### Before Contributing

1. **Check Crucible Standards**: Review [../crucible/](https://github.com/fulmenhq/crucible/) for ecosystem-wide specifications
2. **Review Sibling Libraries**: See how gofulmen and pyfulmen implement similar features
3. **Coordinate Breaking Changes**: Open an issue to discuss cross-language impact
4. **Follow Module Specs**: Implement per specifications in `docs/crucible-ts/standards/library/modules/`

## 📖 Comprehensive Guide

For complete development operations documentation, please see:

**[Development Operations Guide](docs/development/operations.md)**

This guide covers:

- Development workflow and daily commands
- Testing strategy and quality gates
- Release process and version management
- Code standards and TypeScript guidelines
- Security and dependency management
- Community support channels

## 🚀 Quick Start for Contributors

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-username>/tsfulmen
cd tsfulmen

# 2. Bootstrap development environment
make bootstrap

# 3. Sync Crucible SSOT assets
make sync-ssot

# 4. Run tests to verify setup
make test

# 5. Make your changes and run quality checks
make check-all  # lint + typecheck + test
```

## 📋 Contribution Process

1. **Fork Repository** - Create a personal fork for development
2. **Create Branch** - Use descriptive branch names (e.g., `feature/add-config-api`, `fix/logging-bug`)
3. **Make Changes** - Implement with tests and documentation
4. **Quality Checks** - Run `make check-all` to ensure all checks pass
5. **Submit PR** - Pull request with clear description of changes
6. **Code Review** - Address feedback from maintainers
7. **Merge** - Maintainers merge after approval

## ✅ Code Standards

### TypeScript Requirements

- **Strict Mode**: All TypeScript strict flags enabled
- **Type Annotations**: Explicit types for all public APIs
- **Documentation**: TSDoc comments for all exported functions
- **Testing**: Unit tests for all functionality (80%+ coverage target)
- **Error Handling**: Proper error types and messages

### Quality Gates

All contributions must pass:

```bash
make fmt        # Biome formatting
make lint       # Biome linting checks
make typecheck  # TypeScript type checking
make test       # Vitest test suite
```

Or run all at once:

```bash
make check-all  # Comprehensive quality check
```

## 🎯 What to Contribute

### High Priority

- Implementation of core modules (config-path-api, crucible-shim, logging, foundry, schema-validation, three-layer-config, ssot-sync)
- Test coverage improvements
- Documentation enhancements
- Bug fixes with tests

### Welcome Contributions

- API improvements and ergonomics
- Performance optimizations
- Cross-language consistency improvements
- Example code and tutorials
- Developer tooling enhancements

### Please Avoid

- Breaking changes without discussion (open an issue first)
- Changes that conflict with FulmenHQ ecosystem standards
- Contributions without tests
- Code that doesn't pass quality gates

## 🐛 Reporting Issues

- **Bug Reports**: Use GitHub Issues with reproduction steps
- **Feature Requests**: Discuss in GitHub Discussions first
- **Security Issues**: Email dave.thompson@3leaps.net privately

## 💬 Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and ideas
- **Mattermost**: `#agents-tsfulmen` (provisioning in progress)
- **Email**: dave.thompson@3leaps.net

## 📚 Additional Resources

### TSFulmen Documentation

- [TSFulmen Overview](docs/tsfulmen_overview.md) - Architecture and module catalog
- [Bootstrap Guide](docs/development/bootstrap.md) - Detailed setup instructions
- [Crucible Standards](docs/crucible-ts/standards/) - Coding standards and best practices
- [Repository Safety Protocols](REPOSITORY_SAFETY_PROTOCOLS.md) - Operational safety

### Ecosystem Resources

- **[Crucible](https://github.com/fulmenhq/crucible/)** - SSOT for schemas, standards, and specifications
- **[gofulmen](https://github.com/fulmenhq/gofulmen)** - Go helper library (reference implementation)
- **[pyfulmen](https://github.com/fulmenhq/pyfulmen)** - Python helper library
- **[Fulmen Helper Library Standard](docs/crucible-ts/architecture/fulmen-helper-library-standard.md)** - Cross-language requirements
- **[Fulmen Technical Manifesto](docs/crucible-ts/architecture/fulmen-technical-manifesto.md)** - Ecosystem principles

## 🤝 Code of Conduct

We follow the [FulmenHQ Code of Conduct](https://github.com/fulmenhq/.github/blob/main/CODE_OF_CONDUCT.md). Please be respectful, inclusive, and professional in all interactions.

## 📄 License

By contributing to TSFulmen, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

**Questions?** See [docs/development/operations.md](docs/development/operations.md) for comprehensive developer documentation.

---

_Part of the [FulmenHQ](https://github.com/fulmenhq) ecosystem - building enterprise-grade TypeScript applications_
