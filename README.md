# sdd-marketplace

A Claude Code plugin marketplace (`sdd`) for spec-driven development, with four plugins at
**1.0.0**:

| Plugin | What it ships | Depends on |
|---|---|---|
| [`engineering-paved-path`](plugins/engineering-paved-path/) | the React, Next.js, Fastify, architecture, testing and security skills | — |
| [`research-tools`](plugins/research-tools/) | the read-only `researcher` agent | — |
| [`architecture-review`](plugins/architecture-review/) | the generalized `architecture-reviewer` agent | `engineering-paved-path ^1.0.0` |
| [`sdd-engineering`](plugins/sdd-engineering/) | `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`; `/sdd-engineering:run-plan`, `/sdd-engineering:workflow-retro` | the three above, `^1.0.0` |

How the four work together, the `.sdd/config.json` project contract, the guards and the trace:
[`plugins/sdd-engineering/README.md`](plugins/sdd-engineering/README.md). Design:
[`docs/specs/2026-10-17-plugin-set-design.md`](docs/specs/2026-10-17-plugin-set-design.md).

## Install

```bash
claude plugin marketplace add shofulk/sdd-marketplace
claude plugin install sdd-engineering@sdd
```

The stable channel is the `stable` branch with its own catalog `sdd-stable`
(`claude plugin marketplace add shofulk/sdd-marketplace#stable`, then
`claude plugin install sdd-engineering@sdd-stable`); it is created at the first release.

Status: 1.0.0 in development — nothing pushed, tagged or released yet.

## Develop

```bash
npm test               # repository rules, hook library and plugin tests (node:test)
npm run validate       # claude plugin validate --strict on the marketplace and each plugin
npm run sync-hooklib   # copy tools/hooklib/*.mjs into every plugins/*/hooks/lib/
```

Spike results: [`docs/spikes/2026-10-17-spikes.md`](docs/spikes/2026-10-17-spikes.md).
