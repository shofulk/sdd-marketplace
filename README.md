# sdd-marketplace

A Claude Code plugin marketplace (`sdd`) for spec-driven development, with four plugins:

| Plugin | What it ships | Depends on |
|---|---|---|
| `engineering-paved-path` | the React, Next.js, Fastify, architecture, testing and security skills | — |
| `research-tools` | the read-only `researcher` agent | — |
| `architecture-review` | the generalized `architecture-reviewer` agent | `engineering-paved-path` |
| `sdd-engineering` | `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`; `run-plan`, `workflow-retro` | the three above |

Design: [`docs/specs/2026-10-17-plugin-set-design.md`](docs/specs/2026-10-17-plugin-set-design.md).

## Install

```bash
claude plugin marketplace add shofulk/sdd-marketplace
claude plugin install sdd-engineering@sdd
```

Status: in development — nothing released yet.

## Develop

```bash
npm test          # repository rules, hook library and plugin tests (node:test)
npm run validate  # claude plugin validate --strict on the marketplace and each plugin
```
