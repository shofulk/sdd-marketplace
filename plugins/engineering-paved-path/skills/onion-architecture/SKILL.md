---
name: onion-architecture
description: Onion / ports-and-adapters rules for a TypeScript backend (Fastify, Zod, an ORM such as Drizzle, a DI container) — the four rings, what each ring may import, the per-tool rules that keep dependencies pointing inward, how to enforce them with dependency-cruiser, and a review checklist. Use when adding or moving a backend file (a new module, a new adapter, a change to a service, repository, route or the composition root), when deciding where code should live, and when reviewing backend changes for layer violations.
---

# Onion architecture — TypeScript backends

One rule, stated once: **dependencies point inward.** Inner rings declare the interface,
outer rings implement it, and nothing inner ever names anything outer — not by import, not
by type, not by an error class.

This skill is the enforcement contract. It says what is allowed; the project says where its
files are. **The project's ring map lives in the project** — an architecture section of its
docs, a project skill, or the header comment of each file — and the project lists that file
in `.sdd/config.json` `context` so every agent reads it. Where this skill shows paths, they are
the reference layout below, not a requirement.

## The rings

| Ring | Holds | May import |
|---|---|---|
| **0 — Domain / contracts** | entities, value objects, domain rules, port interfaces, the Zod contracts of the API | the validation library (`zod`), other ring-0 files. Nothing else. |
| **1 — Application / services** | use cases: services that orchestrate ports in a sequence, with rules about order, failure and retries; their pure helpers | ring 0, port **types**, repository **types**, the application error classes |
| **2 — Infrastructure** | adapters (one per external system), repositories, the database schema and client, job runners, file and network access | ring 0, its own SDK, the persistence layer |
| **3 — Composition root / edge** | process boot, the HTTP app, route handlers, plugin registration, the DI container, configuration | everything |

Reference layout (adapt the names; keep the rings):

```
src/domain/**                         ring 0 — entities, contracts, ports
src/modules/<name>/service.ts         ring 1 — one use-case service per module
src/modules/<name>/repository.ts      ring 2 — persistence for the module's aggregate
src/adapters/<port>/**                ring 2 — one SDK each
src/db/**                             ring 2 — schema, client, named row types
src/modules/<name>/routes.ts          ring 3 — HTTP handlers
src/app.ts, src/server.ts, src/container.ts   ring 3 — wiring and boot
```

Two facts that decide most arguments:

- **The ring is the file, not the folder.** A module folder is a vertical slice that holds
  ring 1, 2 and 3 files side by side.
- A shared folder that mixes pure and infrastructural code is **not** a ring. Classify each
  file in it into one ring and say so in its header comment.

## Where does this file go — four questions

Ask in order, stop at the first yes.

1. Does it know about HTTP, Fastify, wiring or process boot? → **ring 3** (routes, app,
   container).
2. Does it know about SQL, an SDK, the filesystem, the network or the event loop? →
   **ring 2** (repository, adapter).
3. Does it orchestrate a use case — several ports in a sequence, with rules about order,
   failure and retries? → **ring 1** (the service and its extracted helpers).
4. Is it a rule, a shape or a contract that would still be true with no database and no
   HTTP? → **ring 0** (domain, contracts).

If it wants to be two rings at once, it is two files.

## Per-tool rules

### Fastify — only ring 3 knows it exists

- `import 'fastify'` / `@fastify/*` is legal **only** in route files, the module index,
  the app and server files and plugins. A service importing `FastifyInstance` is a
  violation, not a shortcut.
- `FastifyRequest`, `FastifyReply` and `req.log` never cross into ring 1. The logger is a
  port: pass a structural `Logger` type, which `req.log` satisfies. Never pass `reply` in to
  let a service write a response.
- A route handler does three things: parse the request with its Zod contract, call one
  service method, return a DTO. Branching business rules in a handler belong in the service.
- Failures leave ring 1 as application error classes. HTTP status codes are decided by the
  error handler, never by a service.
- Plugin encapsulation is the wiring seam: a module registers its own routes and builds its
  own service instance at registration time, not at request time.

### Zod — parse at the boundary, trust inside

- Contracts live in ring 0 and are edited only there. They are the language of the ports.
- One contract drives request validation and response serialization (for example
  `fastify-type-provider-zod`). Never hand-write a second response shape.
- Parse once, at the edge. A ring-1 service that re-parses its own arguments is saying it
  does not trust its boundary — move the boundary instead.
- A DTO is not a DB row. A DTO is built by an explicit mapper, never by casting a row.
- A contract field read back out of a stored JSON document must tolerate absence
  (`nullish()`), because old documents do not have new fields.

### The ORM (Drizzle or any other) — persistence is a ring-2 detail

- The ORM, the database driver, the schema module and the client may be imported only from
  the persistence layer, repositories, adapters and the job runner.
- A repository returns domain types or row types named once in a single module (for
  example `db/rows.ts`) — never a query builder, never a partially applied `db` handle,
  never an ORM error.
- An inline `typeof table.$inferSelect` outside that module and the repositories is a leak.
  Ring 1 imports the named row type; the owning repository re-exports it.
- A transaction is owned by the repository or by an explicit unit of work handed in. A
  service must not take the ORM's transaction type as a parameter.
- Schema changes go through the schema module and the ORM's migration generator.
  Migrations are never hand-written.

### The DI container — resolve at construction, never at call time

Services may take the container as their constructor argument. What is not fine is keeping
it and reaching through it later:

- A service's constructor resolves everything it needs into fields (`this.repo`, `this.bus`,
  `this.jobs`) and does not keep `container` as a field it queries inside methods. A method
  body containing `this.container.<anything>` is a service locator: the dependency is
  invisible in the signature. Enforce this forward — a new or edited service resolves in the
  constructor; existing call sites are converted when the file is touched for other reasons,
  never in a drive-by sweep.
- A ring-1 file never constructs a ring-2 concrete class. `new SomeRepository(db)` and
  `new SomeApiClient(token)` belong in the composition root — the only place allowed to know
  which implementation is real.
- Only ports (interfaces from ring 0) appear in ring-1 field and parameter types. A concrete
  provider class as a type in a service is a violation; its port interface is correct.
- Tests inject through container overrides with mock adapters. A service that cannot be
  tested with mocks alone has an undeclared dependency.

### Adapters — one port, one SDK, no upward knowledge

- Every SDK is imported in exactly one adapter folder. A second import site is a missing
  port.
- The port interface is declared in ring 0, never in the adapter. The adapter class names the
  interface it implements.
- Adapters never import modules. If an adapter needs a module's data, the data is passed in.
- Secrets reach an adapter as a constructor argument. Adapters do not read `process.env` and
  do not fetch secrets themselves — the container does that.

### A pure core package — the purity guard

A package that several consumers share as their ring 0 (a scoring engine, a rules library)
may not import the web framework, the ORM, the persistence layer, `node:fs`,
`node:child_process` or any provider SDK. Its only side effects go through injected ports. A
helper that needs the filesystem belongs in an adapter and is passed in.

## Anti-patterns

| Smell | Why it breaks the onion | Move to |
|---|---|---|
| `this.container.x` inside a method | service locator: the dependency is invisible in the signature | resolve in the constructor |
| `new <Concrete>()` in a service | ring 1 naming a ring-2 implementation | the composition root |
| `$inferSelect` / ORM types in a service or DTO | the persistence shape becomes the domain shape | mapper + named row types |
| `req` / `reply` / `app.log` below the route file | HTTP leaks into the use case | `Logger` port, plain arguments |
| Business branching in a route handler | the rule is untestable without an HTTP server | service method |
| Entities as pure data bags with every rule in a service | anemic domain — the onion is only folders | push invariants into the contract/domain helpers |
| A module importing another module's service or repository | slice coupling; the container stops being the wiring | a shared module, named row types, or a repository on the container |
| A repository method that only wraps one `select()` with no aggregate boundary | a worse interface over the database | inline it, or give the repository a real aggregate |

## Enforcement

`enforcement/dependency-cruiser.cjs` in this skill is a template for the machine-checkable
subset of the rules above. To adopt it in a package:

1. Copy it to the package root as `.dependency-cruiser.cjs`.
2. Edit the ring path constants at its top to the project's ring map, and list the package's
   SDKs.
3. Make it the package's `arch` check in `.sdd/config.json`, for example
   `"checks": { "api": { "arch": "npx depcruise src --config .dependency-cruiser.cjs" } }`.
   The architecture reviewer runs that command first.

Severity policy: rules that are already clean are `error`; rules with known outstanding
violations are `warn` and carry an `OUTSTANDING` comment naming every violating file, so a
warning means "this one, still open" and not background noise. Promote a rule to `error` in
the same commit that clears its last violation. Record the baseline (errors, warnings per
rule) when the config is adopted; a change that raises any count is a regression.

Two resolution details that silently break naive regexes:

- pnpm resolves packages to `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/…`, so a rule
  anchored `^node_modules/<pkg>/` never matches. Leave those paths unanchored.
- tsconfig path aliases make dependency-cruiser cruise the aliased package's sources as part
  of the graph, so a rule written over `^src/` can also fire on imports that originate in an
  aliased sibling package. Anchor the `from` side to the package under check.

Type-level leaks (an ORM row in a service signature, an anemic entity) are not expressible in
dependency-cruiser. Those are the review checklist below.

## Review checklist

Before finishing any backend change:

1. Every new file states its ring in the header comment, and the imports agree with it.
2. No ring-1 file imports the web framework, the ORM, the schema module, or a concrete
   adapter class.
3. No method body reaches through `this.container`.
4. Every new SDK import sits in an adapter behind a port declared in ring 0.
5. The package's `arch` check reports no new violations, and no `warn` count went up.
6. The new service path is exercised by a hermetic test using mock adapters. Needing a real
   database to test a use case means the use case is in the wrong ring.

See `examples.md` for before/after pairs, and `references.md` for sources.
