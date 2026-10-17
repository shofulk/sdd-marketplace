# /sdd-engineering:run-plan — delegation prompts

Every prompt starts with `User language: <language the user wrote in>`. Fill `<…>`; drop a block
that would be empty rather than sending it with "none". Paste reports and briefs inline — the
reviewers' Bash runs under the `checks` guard, so whatever they need beyond the configured
checks and the checks script comes in the prompt. `<plans>`, `<runs>` and `<checksDir>` are the
`.sdd/config.json` values (defaults `docs/plans/`, `.sdd/runs/`, `.sdd/checks/`).

## Interface, red or implementation lane — `sdd-engineering:implementer`

```
User language: <…>
Plan: <plans>/<feature>.plan.md · Revision <N>
Lane: L<n> — lanes <list> are Done.
Mode: <omit | red | after>
Context: <the .sdd/config.json context files>
Project skills: <skills.implementer, or omit>
Routing: <the project's routing table path, or omit>
Lane brief:
<output of node ${CLAUDE_PLUGIN_ROOT}/scripts/lane-brief.mjs <plan> L<n>>
Red tests (frozen — turn them green, never edit them):
<Red proof table from the red lane's report, rows whose Covers meet this lane>
Run notes (guidance only, no AC changes):
<classified notes>
Designs (frontend lanes only — Read the images; they show intent, the spec is binding):
<paths / URLs>
Earlier lanes' open issues that touch this lane:
<lines, with report paths>
End the lane with `node ${CLAUDE_PLUGIN_ROOT}/scripts/checks.mjs run <feature> --quick <packages you touched>`.
```

## Red lane — the project's `test-writer` (when `agents` names one)

```
User language: <…>
Mode: red
Plan: <plans>/<feature>.plan.md · Revision <N> · Spec: <spec path>
Lane: L<n> — interface lane L<m> is Done; its files: <list from its report>.
Lane brief:
<lane-brief output>
Write every `red` Test-plan row of the brief; read the spec and the interface files only.
```

Without a `test-writer`, send the implementer prompt above with `Mode: red`.

## After lane or test gap — `test-writer`, else the implementer with `Mode: after`

```
User language: <…>
Mode: after
Plan: <plans>/<feature>.plan.md · Revision <N>
Target: <Test-plan rows with Phase: after | fix-list items T-…>
Designs: <for component tests only>
```

## Review round — every reviewer in one message

Common block, sent to each:

```
User language: <…>
Plan: <plans>/<feature>.plan.md · Revision <N> · Spec: <path>
Context: <the .sdd/config.json context files>
Change set: base <merge-base sha> → working tree.
Checks: <checksDir>/<feature>.md — fresh (checks.mjs status printed `fresh` at <time>)
```

- **`architecture-review:architecture-reviewer`**: + the implementers' *Hand-off to reviewers →
  Architecture* lines, merged.
- **`sdd-engineering:plan-verifier`**: + `Red tests:` (every red lane's *Red proof* table) and
  `Manual acceptance:` (the `NN-manual-acceptance.md` entries, each with its key output line),
  and the resolution of any `red-test dispute`.
- **the project's `security-reviewer`** (only when `agents` names one): + the merged *Hand-off →
  Security* lines and the plan's *Review hand-off → Security review* bullet.

## Fix — `sdd-engineering:implementer` (fix mode)

```
User language: <…>
Mode: fix · Round <r>
Plan: <plans>/<feature>.plan.md · Revision <N>
Fix list (fix exactly these; nothing else changes):
| ID | Source report | Severity | file:line | Finding (verbatim) | Expected after the fix |
Red tests (still frozen): <table>
Previous reports: <paths>
End with `node ${CLAUDE_PLUGIN_ROOT}/scripts/checks.mjs run <feature> --quick <packages you touched>`.
```

## Re-review (delta) — the reviewer that had open items

```
User language: <…>
Re-review · Round <r>
Plan: <plans>/<feature>.plan.md · Revision <N>
Previous report: <runs>/<feature>/<file>
Items to re-judge: <IDs and one-line findings>
Delta: `git diff --name-only <snapshot sha>` is the fix diff; judge every changed line in it as a
new change set, and re-judge each listed item as resolved / not resolved with evidence. Items
outside the delta keep their previous verdict.
Checks: <checksDir>/<feature>.md — fresh
```

## Research — `research-tools:researcher` (one question each, in parallel)

```
User language: <…>
Question: <one checkable question>
Type: A | B | A+B
Scope: <package / module / library + version>
Done when: <which run decision the answer settles>
Context: <the .sdd/config.json context files>
```

## retro-writer (only when `agents` names one)

```
User language: <…>
Plan: <plans>/<feature>.plan.md · Reviewed revision: <N> · HEAD: <sha>
Clean round since the newest retro entry: <yes / no>
Reports (verbatim):
<the round's reports>
```

## doc-writer (only when `agents` names one)

```
User language: <…>
Source: <plans>/<feature>.plan.md (Revision <N>) and the shipped code.
Reports: <paths of the last Implementation Reports and Plan Verification>
Doc kind: <reference / explanation / cross-package overview — from the plan's doc steps>
```
