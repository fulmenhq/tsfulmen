# TSFulmen – Repository Safety Protocols

This document outlines the safety protocols for TSFulmen repository operations. For detailed operational guidelines, see the [Repository Operations SOP](docs/crucible-ts/sop/repository-operations-sop.md).

## Quick Reference

- **Human Oversight Required**: All merges, tags, and publishes need @3leapsdave approval.
- **Use Make Targets**: Prefer `make` commands for consistency and quality gates.
- **Plan Changes**: Document work plans in `.plans/` before structural changes.
- **High-Risk Operations**: See [Repository Operations SOP](docs/crucible-ts/sop/repository-operations-sop.md#high-risk-operations) for protocols.
- **Incident Response**: Follow the process in [Repository Operations SOP](docs/crucible-ts/sop/repository-operations-sop.md#incident-response).

## TypeScript Library Specific Protocols

### Module Development Safety

- **SSOT Discipline**: Never edit synced files in `docs/crucible-ts/`, `schemas/crucible-ts/`, `config/crucible-ts/`
- **Source Files Only**: Edit TypeScript source files in `src/` directory
- **Test Coverage**: Maintain 80%+ test coverage for all modules
- **Type Safety**: Use TypeScript strict mode, no `any` types without justification

### Build and Release Safety

- **Build Verification**: Always run `make build` before commits
- **Test Validation**: Run `make test` and ensure all tests pass
- **Type Checking**: Run `make typecheck` to catch type errors
- **Quality Gates**: Run `make check-all` before any commit

### Dependency Management

- **Lock Files**: Commit `bun.lock` to ensure reproducible builds
- **Security Audits**: Run `bun audit` before adding dependencies
- **Version Pinning**: Pin major versions for stability
- **Minimal Dependencies**: Prefer zero runtime dependencies when possible

## Git Operation Safety

### 🚨 CRITICAL: PUSH AUTHORIZATION

**MANDATORY RULE**: AI agents are NEVER authorized to push code to remote repositories without explicit, per-incident human maintainer approval.

**Safe Operations**:

```bash
git add <files>       # ✅ Stage changes
git commit -m "..."   # ✅ Commit locally
git status            # ✅ Verify state
git diff              # ✅ Review changes
```

**Prohibited Operations**:

```bash
git push              # ❌ NEVER WITHOUT APPROVAL
git push --force      # ❌ CATASTROPHIC - NEVER
git tag               # ❌ Requires approval
git push --tags       # ❌ Requires approval
```

### Operation Risk Levels

#### Level 1: CATASTROPHIC (NEVER without approval)

- History rewriting (`git reset --hard`, `git rebase`)
- Tag creation/deletion
- Remote push operations
- Force operations (`--force`, `--force-with-lease`)
- Branch deletion

#### Level 2: HIGH RISK (Validate before execution)

- Bulk file operations
- Dependency modifications (`package.json`, `bun.lock`)
- Configuration changes affecting CI/CD
- Large refactoring operations
- Schema or type definition changes

#### Level 3: MEDIUM RISK (Proceed with caution)

- Single file edits
- Documentation updates
- Test additions
- Code formatting operations

## Quality Assurance Protocols

### Pre-Commit Checklist

- [ ] All tests passing (`make test`)
- [ ] Type checking clean (`make typecheck`)
- [ ] Linting clean (`make lint`)
- [ ] Build successful (`make build`)
- [ ] No synced files modified
- [ ] Attribution format correct
- [ ] Commit message follows standards

### Pre-Push Checklist

- [ ] All pre-commit checks passed
- [ ] `make check-all` successful
- [ ] Human maintainer approval obtained
- [ ] Changes reviewed and documented
- [ ] No secrets or local paths committed

## Cross-Language Coordination

### API Alignment

- Coordinate interface changes with gofulmen and pyfulmen teams
- Maintain parity in module capabilities
- Share test fixtures for cross-language validation
- Document TypeScript-specific enhancements

### Schema Compliance

- Validate against Crucible schemas
- Report schema issues to Crucible team
- Never modify synced schemas locally

## References

- [Repository Operations SOP](docs/crucible-ts/sop/repository-operations-sop.md) (canonical standard)
- [Repository Safety Framework](docs/crucible-ts/standards/repository-safety-framework.md)
- [Agentic Attribution Standard](docs/crucible-ts/standards/agentic-attribution.md)
- `AGENTS.md`
- `MAINTAINERS.md`
- [Makefile Standard](docs/crucible-ts/standards/makefile-standard.md)
- [Release Checklist Standard](docs/crucible-ts/standards/release-checklist-standard.md)
- [CI/CD Operations SOP](docs/crucible-ts/sop/cicd-operations.md)

---

**Last Updated**: October 10, 2025  
**Next Review**: After first release (v0.1.0)
