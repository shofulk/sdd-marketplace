#!/usr/bin/env bash
# Fixture for the run-plan eval: a dependency-free Node project (tests run with `node --test`,
# no install), the project contract, an approved spec and a Ready two-AC plan, committed, with
# a local bare remote so `origin/main` exists. Runs in the empty eval workspace.
set -euo pipefail
export GIT_AUTHOR_DATE="2026-10-17T10:00:00Z" GIT_COMMITTER_DATE="2026-10-17T10:00:00Z"

mkdir -p .sdd .spec docs/plans src test
cat > package.json <<'EOF'
{
  "name": "greet",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
EOF
cat > .sdd/config.json <<'EOF'
{
  "checks": { "app": { "test": "node --test" } }
}
EOF
cat > .gitignore <<'EOF'
.sdd/*
!.sdd/config.json
node_modules/
EOF
cat > README.md <<'EOF'
# greet

A tiny library: `greet(name)` returns a greeting. Source in `src/`, tests in `test/`
(`node --test`). The package is named `app` in `.sdd/config.json`.
EOF
touch src/.gitkeep test/.gitkeep

cat > .spec/greet.spec.md <<'EOF'
# Spec: Greet
Spec ID: SPEC-01-greet
Status: approved
Supersedes: none

## Problem and user

A developer needs a greeting string for a person's name, and a safe default when the name is
missing.

## Goals / Non-goals

Goals:
- Return a greeting for a name.
- Return a default greeting when there is no name.

Non-goals:
- Localisation. The greeting is English only.

## User stories

- **US-1** As a developer, I want a greeting for a name, so that I can show it to the user. → AC-1, AC-2

## Acceptance criteria (EARS)

- **AC-1** WHEN `greet` is called with a non-empty name, the `greet` function shall return
  the text "Hello, <name>!". *Verify: unit*
- **AC-2** IF `greet` is called with no name or an empty name, THEN the `greet` function shall
  return the text "Hello, world!". *Verify: unit*

## Edge cases

- **EC-1** The caller passes an empty string. → AC-2

## Non-functional requirements

None.

## Assumptions

- **A-1** Callers pass a string or nothing. Risk if wrong: other types are turned into text.

## Inputs and provenance

- Request: "a greet function with a default".

## Untrusted inputs

- The name comes from the caller and is returned as text only; it is never evaluated.

## Open questions

None. The request settles every point.

## Traceability

| AC | Stories | Edge cases | NFR | Verify |
|----|---------|------------|-----|--------|
| AC-1 | US-1 | — | — | unit |
| AC-2 | US-1 | EC-1 | — | unit |
EOF

git init -q -b main
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
git add -A
git commit -q -m "greet: project, contract and approved spec"
BASE=$(git rev-parse --short HEAD)

cat > docs/plans/greet.plan.md <<EOF
# Development Plan: greet

**Spec:** \`.spec/greet.spec.md\` · **Packages:** app · **Base:** ${BASE} · **Revision:** 1 · **Execution mode:** single-agent

## Goal
Add a \`greet(name)\` function that returns a greeting, with a default for a missing name.

## Acceptance criteria
1. **AC1** — WHEN \`greet\` is called with a non-empty name, the \`greet\` function shall return the text "Hello, <name>!". *Verify: unit*
2. **AC2** — IF \`greet\` is called with no name or an empty name, THEN the \`greet\` function shall return the text "Hello, world!". *Verify: unit*

## Recommendations
none

## Constraints
- **Architecture:** \`src/greet.js\` is a pure module: no I/O, no dependencies.
- **Contracts & data:** \`src/greet.js\` exports \`greet(name)\`; \`name\` is a string or undefined.
- **Do not touch:** \`package.json\`, \`.sdd/config.json\`, \`.spec/\`.
- **Planner questions:** none
- **Project context:** none — the project has no context files.

## Steps
| ID | Package | Files (create / modify) | Change | Skills | Covers | Lane | Verify |
|----|---------|-------------------------|--------|--------|--------|------|--------|
| S1 | app | \`test/greet.test.js\` (create) | tests T1 and T2 with \`node:test\` and \`node:assert/strict\` | — | AC1, AC2 | L1 | \`node --test\` |
| S2 | app | \`src/greet.js\` (create) | export \`greet(name)\`: "Hello, <name>!" for a non-empty string, "Hello, world!" otherwise | — | AC1, AC2 | L1 | \`node --test\` |

## Execution
| Lane | Agent | Steps | Depends on | Parallel with |
|------|-------|-------|------------|---------------|
| L1 | implementer | S1–S2 | — | — |

The plan has 2 steps, so the interface and red lanes are skipped: the implementer writes the tests first inside its lane.

## Test plan
| Test | Kind | Phase | Covers | Lane | File |
|------|------|-------|--------|------|------|
| T1 | unit | impl | AC1 | L1 | \`test/greet.test.js\` |
| T2 | unit | impl | AC2 | L1 | \`test/greet.test.js\` |

## Review hand-off
- **Architecture review:** \`src/greet.js\` — a pure module.
- **Security review:** none

## Risks / open questions
- none

## Out of scope
- **O1** — no command-line tool and no HTTP endpoint.

## Revisions
- rev 1 · 2026-10-17 · Initial plan from implementation-planner: S1–S2, AC1–AC2 · eval fixture

**Plan status:** Ready
EOF
git add docs/plans/greet.plan.md
git commit -q -m "greet: plan"

git init -q --bare -b main remote.git
echo "remote.git/" >> .git/info/exclude
git remote add origin ./remote.git
git push -q origin main
git remote set-head origin main
