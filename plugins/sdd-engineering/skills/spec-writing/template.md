# Spec format — the format of record

Every spec in a project that uses `sdd-engineering` follows this file. The `spec-lint` hook
checks it on every write, and `spec-guard` keeps the spec writer inside it.

## Where specs live

- A feature that touches **one package** keeps its spec in that package:
  `<pkg>/.spec/<feature>.spec.md`.
- A feature that touches **two or more packages** has **one** spec in the cross-module folder,
  `<specs>/<feature>.spec.md`, and no per-package specs next to it. `<specs>` is the `specs`
  key of `.sdd/config.json` (default `specs/`).
- One file per feature, `<feature>` in kebab-case.

## Role in the chain

```
feature request + designs ─► spec-creator ─► spec (draft ─► approved) ─► implementation-planner ─► plan ─► run-plan
```

The spec fixes behaviour, boundaries and contracts; the plan decides files, modules, step order
and code.

## Rules

- A spec is written **before** the code. It says what the system shall do and why — not how it
  is built. Usually it has no implementation details.
- A spec **may** contain:
  - workflow diagrams (user flow, feature states — Mermaid `flowchart`, `stateDiagram-v2`);
  - communication diagrams between services and packages (Mermaid `sequenceDiagram`);
  - contracts at the boundary — route and method, request/response fields, events, tool
    inputs/outputs, error cases. Described by fields, not by schema code.
- A spec does **not** contain: new file paths, component trees, function or class names,
  internal module layout, library choices, SQL or schema code, step order. Only if the user
  asks for a technical constraint, it is written as a requirement with its reason.
- Diagrams stay small (about 15 nodes at most), use real names, and support the EARS criteria —
  they never replace them.
- Plain English, level B1: short sentences, common words, active voice, one term for one thing.
  Code names stay as in the code.
- Name the existing contracts the feature touches — routes, schemas in the shared contracts,
  tables, events, tools. That makes the spec checkable.
- Every requirement has a source in *Inputs and provenance*.

## Spec ID and status

- `Spec ID: SPEC-NN-<feature>` — a global number across the whole project (the cross-module
  folder and every `<pkg>/.spec/`) plus the feature slug, the same as the file name. Example:
  `web/.spec/intent-card.spec.md` → `SPEC-07-intent-card`. Next number = highest existing + 1.
  A spec that supersedes one of the same feature keeps the slug with a new number. Specs
  written before this format have no ID and are not checked.
- `Status:`
  - `draft` — being written; may change.
  - `approved` — the user said yes; **frozen**. A change is a new spec with `Supersedes:`. An
    approved spec has no `(blocking)` open question.
  - `implemented` — the feature shipped. The main session sets it after `plan-verifier`
    reports every `AC-n` of the spec as met. `spec-creator` never sets it.
- `Supersedes: <path> (SPEC-NN-<feature>)` when the spec replaces an earlier decision; otherwise
  `none`.

## Template

```markdown
# Spec: <feature name>
Spec ID: SPEC-NN-<feature>
Status: draft | approved | implemented
Supersedes: none | <path> (SPEC-NN-<feature>)

## Problem and user
## Goals / Non-goals
## User stories
## Acceptance criteria (EARS)
## Module interactions          <- only in the cross-module folder
## Edge cases
## Non-functional requirements
## Assumptions
## Inputs and provenance
## Untrusted inputs
## Open questions
## Traceability
```

All sections, in this order. No section is removed. A section with nothing to say says `None.`
and why. `## Module interactions` is required in the cross-module folder and absent in
`<pkg>/.spec/`: a communication diagram and the boundary contracts — which route the browser
calls, which contract carries the data, which table is read or written, which events flow.

### Item formats

Every item has a stable ID. IDs never change and are never reused inside one spec; the planner,
the tests and `plan-verifier` cite them.

| Section | Format |
|---------|--------|
| User stories | `- **US-1** As a <user>, I want <goal>, so that <benefit>. → AC-1, AC-2` |
| Acceptance criteria | `- **AC-1** [web] WHEN <trigger>, the <part> shall <response>. *Verify: e2e*` |
| Edge cases | `- **EC-1** <situation>. → AC-5` |
| Non-functional requirements | `- **NFR-1** <area>: <requirement with a number and unit>. *Verify: it*` |
| Assumptions | `- **A-1** <what we take as true without proof>. Risk if wrong: <one line>.` |
| Open questions | `- **Q-1** (blocking \| non-blocking \| planner) <question>` |

- **Package tag** `[<pkg>]` — required on every `AC-n` in the cross-module folder, optional in
  `<pkg>/.spec/`. When `.sdd/config.json` `checks` lists packages, the tag is one of them.
- **Verify hint** — how the criterion is checked: `unit`, `it` (an integration test against a
  real database or service), `e2e`, `manual`, or several joined by `+` (`unit + e2e`). It says
  what kind of check, never which file or test name.
- **Traceability** — one table row per acceptance criterion:

  ```markdown
  | AC | Stories | Edge cases | NFR | Verify |
  |----|---------|------------|-----|--------|
  | AC-1 | US-1 | — | — | e2e |
  | AC-5 | US-2 | EC-1, EC-3 | NFR-2 | unit + e2e |
  ```

  Every user story points to at least one `AC-n`. Every edge case points to at least one
  `IF … THEN` criterion. Every ID in the table exists in its section.
- **Open questions** — `blocking` must be answered before `approved`; `non-blocking` may stay;
  `planner` is a how-question left for `implementation-planner`.
- **`[NEEDS CLARIFICATION: Q-n]`** — the inline marker of an unsettled point. A draft puts it in
  the exact item (`AC-n`, `EC-n`, `NFR-n`, a contract row, a sentence) whose text depends on the
  answer, so an open question is visible where it matters. Every marker cites a `(blocking)`
  `Q-n`, and every `(blocking)` `Q-n` has at least one marker. When the user answers, the text is
  rewritten, every marker of that question is removed, the `Q-n` item goes (its number is not
  reused) and the answer is recorded in *Inputs and provenance*. An `approved` spec has no
  marker; the planner refuses to plan from a spec that still has one.

## Acceptance criteria: EARS

EARS (Easy Approach to Requirements Syntax; Mavin et al., Rolls-Royce, IEEE RE'09) separates the
condition from the system response. Each criterion is one sentence with `shall`, and can be
checked without asking the author.

| Pattern | Form |
|---------|------|
| Ubiquitous | The `<part>` shall `<response>`. |
| Event-driven | WHEN `<trigger>`, the `<part>` shall `<response>`. |
| State-driven | WHILE `<state>`, the `<part>` shall `<response>`. |
| Unwanted behaviour | IF `<unwanted condition>`, THEN the `<part>` shall `<response>`. |
| Optional feature | WHERE `<feature is enabled>`, the `<part>` shall `<response>`. |

| Vague | Checkable |
|-------|-----------|
| "Must work well on big repos" | WHEN the repository is larger than the indexing limit, the service shall build the overview only from deterministic facts, without reading every file in full. |
| "Must not fail if the model is down" | IF the structured model call fails, THEN the service shall show the deterministic overview with the reason for the degradation. |
| "Should suggest where to start reading" | The service shall order the reading path by file rank in the import graph. |

Words that cannot be tested are not allowed in criteria and NFRs: *fast*, *quickly*, *nice*,
*properly*, *user-friendly*, *intuitive*, *easy*, *robust*, *seamless*, *appropriate*,
*as needed*, *etc.*

How to write a good spec — design review checklist, examples, self-check — is the
`spec-writing` skill (`SKILL.md` beside this file); a full example is
`references/intent-card.spec.md`.
