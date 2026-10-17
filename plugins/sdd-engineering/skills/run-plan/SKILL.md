---
name: run-plan
description: "Runs the execution half of Spec Driven Development for one feature whose approved plan already exists — lanes (interface → red tests → implementation), the full checks gate, manual acceptance, the parallel review round (architecture, plan traceability, and security when the project has a security reviewer), and fix rounds until the reviewers are clean, then the finish steps. Takes a spec or plan path, optional extra notes and optional designs. Does NOT run spec-creator or implementation-planner — those are run before it. Invoke only when the user types /sdd-engineering:run-plan."
argument-hint: '<spec-or-plan path> [notes: "<extra requirements>"] [design: <png|url> …] [--rounds N] [--resume] [--from lanes|gate|review|fix|finish]'
disable-model-invocation: true
---

# /sdd-engineering:run-plan — run an approved plan to a reviewed change set

The main session is the orchestrator: it dispatches every agent, owns every user question,
writes every run file, and never writes product code itself. The agents' rules live in their
own files; this skill is the procedure that strings them together. Delegation prompts are in
`prompts.md`, finding triage in `triage.md` (beside this file) — read each when its phase
starts.

**Not in this command:** `sdd-engineering:spec-creator` (writes and approves the spec) and
`sdd-engineering:implementation-planner` (writes and revises the plan). When a phase needs
either, the run **stops** and tells the user which one to run and with what input; it never
calls them.

## The project contract

Read `.sdd/config.json` at the project root if it exists; without it, the defaults apply.

| Key | Used for | Default |
|-----|----------|---------|
| `context` | files every agent reads first; pass them in prompts as `Context:` | `[]` |
| `specs`, `plans` | where the spec and the plan live | `specs/`, `docs/plans/` |
| `runs` | run files: `<runs>/<feature>/` | `.sdd/runs/` |
| `checks` | per package, the typecheck / lint / test / arch commands of the gate | `{}` — ask the user for the commands once and, on their yes, write them to `.sdd/config.json` |
| `checksDir` | the checks record | `.sdd/checks/` |
| `routing` | the project's file → skill table, passed to the implementer | none |
| `agents` | optional project agents this run uses when present | `[]` |
| `skills` | project skills per plugin agent, named in its prompt (`Project skills:`) | `{}` |

**Optional project agents** (`agents`), and what happens without each:

- **`test-writer`** — writes the red lane (red mode) and after-lane tests.
  With no `test-writer`, the implementer writes the red tests in L2 (`implementer (red)`).
  Test fixes then go to the implementer in fix mode.
- **`security-reviewer`** — joins the review round.
  With no `security-reviewer`, the review round is architecture + plan.
- **`retro-writer`** — opens each fix round with a convergence check.
  With no `retro-writer`, only the round budget stops the fix loop.
- **`doc-writer`** — writes the docs the plan or the change needs in Phase 6.
  With no `doc-writer`, Phase 6 lists the doc needs in `summary.md` for the user.

Project agents are dispatched by the names `agents` gives. The plugin agents are always
dispatched by namespaced name: `sdd-engineering:implementer`, `sdd-engineering:plan-verifier`,
`architecture-review:architecture-reviewer`, and `research-tools:researcher` when a lane or a
review stops on a fact that needs research (an external API limit, a library behaviour, why
something was built this way) — one concrete question per researcher, run in parallel, the
reports passed back as `Research:`.

## Arguments

| Input | Meaning |
|-------|---------|
| `<path>` | A plan `<plans>/<feature>.plan.md`, or a spec — then the plan is the one whose `**Spec:**` header names it. Required. |
| `notes: "…"` | Extra requirements for this run. See *Notes* below. |
| `design: …` | Zero or more image paths, a local page URL, or a Figma link (usable only with a Figma tool; otherwise ask for a PNG). |
| `--rounds N` | Fix-round budget after the first review round. Default **3**. |
| `--resume` | Continue from `<runs>/<feature>/state.md`. |
| `--from <phase>` | Start at a phase; earlier phases must be done in the state file. |

**No `<path>`:** reply with the line
`run-plan: usage: /sdd-engineering:run-plan <spec-or-plan path> [notes: "…"] [design: …] [--rounds N] [--resume] [--from <phase>]`,
then the plans found under `<plans>` (or `no plans found under <plans>`), and stop — no run
files are written.

**Notes** are classified before anything runs. Guidance that leaves every `AC*` and the scope
unchanged ("reuse the existing hook", "keep the old endpoint alive") goes to every lane as
`Run notes:`. Anything that adds, removes or changes behaviour is a plan change: stop and tell
the user to run `implementation-planner` in Update mode with the plan path and the notes as the
change request. When unsure which it is, ask (`AskUserQuestion`).

**Designs** go to the lanes that touch the frontend, to the after-mode tests, and to manual
acceptance; never to backend lanes or to the reviewers.

## Run files

Everything lives under `<runs>/<feature>/` (gitignored with the rest of `.sdd/` but
`config.json`): `state.md`, and one file per agent report, `NN-<agent>-<lane or round>.md`,
written verbatim the moment the agent returns. Later phases cite these paths instead of
carrying reports in context, and `--resume` rebuilds the run from them.

`state.md` holds these lines, kept current after every phase (more lines may follow them —
lanes done, round, open items):

```
Plan: <path>
Revision: <n>
Phase: <lanes|gate|review|fix|finish>
Status: running|done|blocked
Plan verification: <met>/<total>
Plugins: <name>@<version>, …
```

- `Revision` is the plan's `**Revision:**`.
- `Plan verification` is plan-verifier's `AC summary:` line — acceptance criteria met over the
  plan's total; `0/<total>` until the first review round.
- `Plugins` lists the four plugins this run ran on: for each of `engineering-paved-path`,
  `research-tools`, `architecture-review`, `sdd-engineering`, the newest record in
  `.sdd/trace.jsonl` (`tail -n 40 .sdd/trace.jsonl`; each plugin's SessionStart hook appends
  `{time, session_id, plugin, version}`), written `name@version`. A plugin with no record is
  written `name@unknown`.
- `Status: blocked` whenever the run stops for a user or a planner decision; `done` only at
  the end of Phase 6.

## Phase 0 — Preflight

1. Resolve the plan. Stop if: no plan exists for the spec (→ "run implementation-planner with
   `<spec>`"); the plan's trailing `**Plan status:**` is not `Ready`; the spec is not
   `approved`.
2. `node ${CLAUDE_PLUGIN_ROOT}/scripts/lane-brief.mjs <plan> --lanes` — the lane table. A plan
   without lanes, or with a lane over 6 steps, was written before lanes existed: say so and ask
   whether to run it as is or have the planner re-cut it (Update mode).
3. Branch: on the default branch, create `feat/<feature>` (`git switch -c`) — never commit.
4. Environment: read in the context files how the project's stack is started and checked, and
   probe only what manual acceptance will need (a running service, a container runtime), so
   Phase 3 knows what it can run.
5. Classify `notes:`; check every `design:` path exists.
   Then run `git check-ignore -q .sdd/trace.jsonl`. A non-zero exit means the project does not
   ignore `.sdd/`, and the run files and the trace (local paths, session ids) would be committed
   by a broad `git add`: tell the user to add these two lines to `.gitignore`, record it in the
   run summary, and continue — it is a warning, not a stop:
   ```
   .sdd/*
   !.sdd/config.json
   ```
6. Write `state.md` (`Phase: lanes`, `Status: running`, `Plan verification: 0/<n ACs>`, the
   `Plugins:` line), then print a five-line run summary (plan + revision, lanes and agents, red
   lane yes/no, environment, round budget) and start. Do not ask for confirmation — the user
   started the command.

## Phase 1 — Lanes

Dispatch lanes in `## Execution` order with the `prompts.md` templates. A lane starts only after
every lane in its *Depends on* returned `Done`; lanes marked *Parallel with* each other go out in
one message. Pass each lane its brief inline (`Lane brief:`), never the plan. A lane whose agent
is `test-writer` goes to the project's `test-writer` when `agents` names one, else to
`sdd-engineering:implementer` with `Mode: red` (or after).

After each lane returns, write its report file, then:

| Report | Action |
|--------|--------|
| `Done` | next lane |
| red lane, `Done` | check its *Red proof* has a hash for every `red` row of its brief; keep the table — every later implementer lane and plan-verifier gets it as `Red tests:` |
| `Partial`, only `manual acceptance:` items | collect them for Phase 3, next lane |
| `Partial`, `red-test dispute` | ask the user: fix the test (re-run the red lane on that row), or the spec reading is wrong (stop → planner Update mode) |
| `Partial`, a failing check after 3 attempts | one fix dispatch of the same lane with the failure excerpt and its report path; still failing → stop and ask |
| `Blocked` | stop, show the gate reason; a plan problem → planner Update mode |

## Phase 2 — Checks gate

`node ${CLAUDE_PLUGIN_ROOT}/scripts/checks.mjs run <feature> <every touched package>` (full
mode). A failure goes back to the implementer of the package that fails, with the excerpt, as a
gate fix (at most 2; not a review round). Then
`node ${CLAUDE_PLUGIN_ROOT}/scripts/checks.mjs status <feature>` must print `fresh` before
Phase 4, and again after every later edit. Set `Phase: gate`.

## Phase 3 — Manual acceptance

Run every collected `manual acceptance:` line the session can run: reuse a healthy stack, never
start a second one on top of it. With `design:` inputs and a stack up, compare the touched pages
with the designs — missing states, copy, layout. Record each result as the command or action
plus its key output line in `NN-manual-acceptance.md`. What the session could run but did not
stays *cannot verify*. An item only the user or an absent browser can run is written as
`awaiting manual: <item> — <what to run> — <why it could not run>`; plan-verifier counts it
separately, and it reaches the user through `summary.md`.

## Phase 4 — Review round

In one message, in parallel: `architecture-review:architecture-reviewer`,
`sdd-engineering:plan-verifier`, and the project's `security-reviewer` when `agents` names one
— with `Checks: <checksDir>/<feature>.md — fresh`, `Red tests:`, `Manual acceptance:` and the
change set (`prompts.md`). With no `security-reviewer`, the round is architecture + plan. Write
the reports; set `Plan verification:` in `state.md` from plan-verifier's `AC summary:` line;
then triage the reports (`triage.md`) into one numbered fix list. Clean on all reviewers →
Phase 6. Set `Phase: review`.

**Mutation requests.** plan-verifier cannot edit code, so a Test-plan row that claims a test
catches a fault comes back `cannot verify` with a `Mutation request:` line. Run each one in a
scratch copy, never in the working tree: `git worktree add --detach "$TMPDIR/<feature>-ma-<n>" HEAD`,
apply the uncommitted change set there (`git diff HEAD | git -C <copy> apply`), make the edit the
request names, run the test it names, keep the output, then
`git worktree remove --force <copy>`. Record each as
`MA-<n>: <mutation> — <test> — failed | passed — <the output line>` in the run's manual
acceptance file and pass the lines to a plan-verifier delta run in `Manual acceptance:`. A
mutation the test does not catch is a weak test: it goes to the fix list.

## Phase 5 — Fix rounds

Round `r` = 1 … `--rounds`, `Phase: fix`:

1. **Convergence first** — only when `agents` names a `retro-writer`: dispatch it with the plan
   path, revision, the round's reports verbatim and `HEAD`. `Converging: no` → stop all fixing
   and ask the user with its sign-off options. With no `retro-writer`, only the round budget
   stops the fix loop.
2. **Snapshot**: `git stash create` (prints a sha, changes nothing; empty output means a clean
   tree — use `HEAD`). The delta review below diffs against it.
3. **Dispatch fixes** from the fix list: code items to `sdd-engineering:implementer` (fix mode),
   test items to the project's `test-writer` (after mode) or the implementer, grouped by
   package; groups with disjoint files go out in parallel. Plan-level items are not fixed here —
   stop and name the planner input.
4. **Gate**: Phase 2 again.
5. **Re-review the delta**: only the reviewers that had open items, each told the snapshot sha,
   the previous report path and the item IDs it must re-judge (`prompts.md`, *Re-review*).
   plan-verifier always re-runs when any fix touched a file a plan item names; update
   `Plan verification:`.
6. Triage again. Clean → Phase 6. Items left and budget left → next round. Budget spent → ask
   the user: one more round, accept the rest as known issues, or stop for a planner Update.

A finding the main session believes is wrong is never dropped silently: it is verified against
the code first and, if rejected, recorded with the evidence under *Rejected* in the fix list, so
the next reviewer round sees why.

## Phase 6 — Finish

`Phase: finish`.

1. Docs: when the plan or the change needs docs (a README, a diagram), dispatch the project's
   `doc-writer` if `agents` names one, with the plan path and the run's report paths; otherwise
   list the needs in `summary.md`.
2. If the project has a `pr-self-review` skill or command, run `/pr-self-review`; it may reuse
   the fresh checks record. A confirmed critical → one more fix round, if budget is left.
   Otherwise skip and say so.
3. When plan-verifier reported every `AC*` met, set the spec's `Status:` to `implemented` (the
   main session's step; the spec is otherwise frozen).
4. Project skills wrap-up: run the after-steps of the project skills `skills` names for the
   agents of this run (for example, a lessons file update) for the touched packages.
5. Write `summary.md` and print it short: lanes, rounds, findings fixed / rejected / accepted,
   open minors, what is not verified, the plugin versions from `state.md`.
6. Set `Status: done` in `state.md`. Tell the user the run report is
   `/sdd-engineering:workflow-retro <feature>`, and ask whether to commit — never commit or open
   a PR unasked.

## Stop rules

- A stop always says **why**, **what to run next** (with the exact input), and that
  `/sdd-engineering:run-plan <path> --resume` continues afterwards; `state.md` says
  `Status: blocked` until then.
- Never edit product code, tests, plans or specs in the main session to "save a round" — an
  in-place fix bypasses every gate.
- One `AskUserQuestion` per decision cluster, recommended option first.
