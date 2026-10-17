# engineering-paved-path

The paved-path stack skills — React, Next.js, Fastify, architecture, testing and security — for
TypeScript projects on Fastify / Next.js / React with onion layering. Part of the `sdd`
marketplace; `architecture-review` and `sdd-engineering` depend on it.

## Skills

| Skill | What it covers | Preloaded by |
|---|---|---|
| `onion-architecture` | backend rings, what each may import, Fastify / Zod / ORM / DI-container / adapter rules, dependency-cruiser enforcement template, review checklist | `sdd-engineering:implementation-planner`, `sdd-engineering:implementer`, `architecture-review:architecture-reviewer` |
| `frontend-ui-architecture` | React / Next.js code organization: where components, constants, helpers, hooks and logic go, splitting, the server–client boundary, import rules | the same three agents |
| `nextjs-app-router` | Next.js 15 App Router: file conventions, Server/Client Components, data fetching and caching defaults, Server Functions, route handlers, errors, metadata — linked to the docs | — (model-invoked) |
| `react-best-practices` | modern React conventions and anti-patterns | — (model-invoked) |
| `react-testing-library` | RTL + Vitest: user-flow tests, query priority, MSW | — (model-invoked) |
| `fastify-best-practices` | Fastify routes, plugins, schemas, hooks, errors, testing, deployment | — (model-invoked) |
| `security` | OWASP Top 10:2025 guidance with unsafe/safe examples and checklists | — (model-invoked) |

Agents preload a skill by its namespaced name, for example
`skills: [engineering-paved-path:onion-architecture]`. Any session with the plugin enabled can
also invoke them, e.g. `/engineering-paved-path:security`.

The project keeps its own ring map (which of its paths sit in which ring) in its docs or a
project skill, and lists that file in `.sdd/config.json` `context`. To enforce the rings, copy
`skills/onion-architecture/enforcement/dependency-cruiser.cjs` into the package and make it the
package's `arch` check.

## Hooks

`SessionStart`: appends `{time, session_id, plugin, version}` to `.sdd/trace.jsonl` in the
project, so each session records which version of this plugin loaded.

## Sources

See `NOTICE`. `nextjs-app-router` is written for this plugin from the Next.js 15 docs.
