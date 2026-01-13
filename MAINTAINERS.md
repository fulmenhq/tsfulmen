# TSFulmen - Maintainers

**Project**: tsfulmen
**Purpose**: TypeScript Fulmen Helper Library - Ergonomic access to Crucible SSOT assets and core utilities for TypeScript/Node.js applications
**Governance Model**: 3leaps Initiative

## Human Maintainers

### @3leapsdave (Dave Thompson)

- **Role**: Project Lead & Primary Maintainer
- **Responsibilities**: Architecture oversight, release management, module governance, cross-language coordination
- **Contact**: dave.thompson@3leaps.net | GitHub [@3leapsdave](https://github.com/3leapsdave) | X [@3leapsdave](https://x.com/3leapsdave)
- **Supervision**: All AI agent contributions

## Autonomous Agents

_None configured. This repository uses supervised mode only._

## AI-Assisted Development

This repository uses AI assistants in **supervised mode**. See [AGENTS.md](AGENTS.md) for operating model, available roles, and session protocol.

### Available Roles

| Role       | Use Case                        |
| ---------- | ------------------------------- |
| `devlead`  | Implementation, features, fixes |
| `devrev`   | Code review, four-eyes audit    |
| `infoarch` | Documentation, schemas          |
| `entarch`  | Ecosystem coordination, parity  |
| `secrev`   | Security review                 |

See [Role Catalog](config/crucible-ts/agentic/roles/README.md) for full role definitions.

## Governance Structure

- Human maintainers approve architecture, releases, and supervise AI agents
- AI assistants execute tasks under supervision, following role-based attribution
- See `REPOSITORY_SAFETY_PROTOCOLS.md` for guardrails and escalation paths

## Cross-Language Coordination

TSFulmen coordinates with sibling helper libraries:

- **gofulmen** - Go implementation (reference)
- **pyfulmen** - Python implementation
- **rsfulmen** - Rust implementation
- **Future**: csfulmen (C#)

Weekly sync meetings ensure API alignment and shared standards compliance.

---

**Last Updated**: January 2026
