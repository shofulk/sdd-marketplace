---
name: workflow-retro
description: Reports on one finished /sdd-engineering:run-plan run — reads the run's state and reports, runs the usage digest over the local transcripts, writes the run retro (outcome, what went well, what went wrong by class, decisions, the plugin versions the run used) and appends one row to the run ledger. Takes the feature slug or the run folder. Refuses a run that is not done. Invoke only when the user types /sdd-engineering:workflow-retro.
argument-hint: <feature | <runs>/<feature>/>
disable-model-invocation: true
---

# /sdd-engineering:workflow-retro — the report of a finished run

The main session writes the retro of one `/sdd-engineering:run-plan` run. The retro and the
ledger row are committed with the change, so they cite only committed evidence (the plan, the
spec, shas, the usage digest with its run date) — never a path inside `.sdd/`, which is not
committed. Run it once per finished run; a correction is a new ledger row, never an edit.

## The project contract

Read `.sdd/config.json` at the project root if it exists: `runs` (default `.sdd/runs/`),
`retros` (default `docs/retros/`), `plans` (default `docs/plans/`) and `specs` (default
`specs/`). `<runs>`, `<retros>` below are those values.

## Step 0 — Gate

1. Resolve the run folder: the argument as a folder, or `<runs>/<feature>/`. Read
   `<runs>/<feature>/state.md`.
2. If the folder or `state.md` is missing, stop: name the path you looked for and say a run
   must finish `/sdd-engineering:run-plan` first.
3. If its `Status:` is not `done`, stop and refuse: quote the `Phase:` and `Status:` lines and
   say what to run next (`/sdd-engineering:run-plan <plan> --resume`). A retro of an unfinished
   run would report a guess.
4. If `<retros>/<feature>.md` already exists for this plan revision, stop and ask whether this
   is a second run of the feature (then the retro file gets a `-<n>` suffix) or a correction.

## Step 1 — Gather

- From `state.md`: the `Plan:`, `Revision:`, `Plan verification:` and `Plugins:` lines, and the
  lanes and rounds recorded after them.
- From the run folder: the lane reports (`NN-implementer-L<n>.md`, red lanes), each round's
  reports and fix list (`NN-fix-list.md`), `NN-manual-acceptance.md`, `summary.md`. Read the
  *first* and the *last* plan-verifier report for the verdict counts.
- From the plan: the spec path, the execution mode, the lane table.
- Run the usage digest once, from the project root:

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/usage.mjs --feature <feature>
  ```

  Take *By feature (plan)* (sessions, subagent runs, input · output tokens) and *Rounds per
  feature* (launches per agent type). Note the date you ran it; the retro cites it as
  "usage digest, run <date>". When it prints no transcripts (for example in a sandbox), say so
  in the retro instead of inventing numbers.

## Step 2 — Write `<retros>/<feature>.md`

Plain English. Every number carries its source. Sections, in this order:

```markdown
# Run retro: <feature> (<SPEC-NN or "criteria from request">)

**Plan:** `<plans>/<feature>.plan.md` · Revision <n> · **Mode:** <multi-agent | single-agent> · **Date:** <YYYY-MM-DD>

## Outcome
| Measure | Value | Source |
|---------|-------|--------|
| Lanes | <n> (<interface · red · implementation · after>) | plan *Execution* |
| Fix rounds | <n>, budget <N> | run reports |
| Plan verification, first → final | <met · partial · not met · cannot verify> → <…>; AC <met>/<total> | plan-verifier reports |
| Checks at the end | <per package: result and the key summary line> | final checks record |
| Not verified | <awaiting-manual items, with what to run> | `summary.md` |
| Red tests | <n frozen files, hashes matched / mismatched> | plan-verifier *Red tests* |
| Subagent runs · tokens | <n runs · input · output> | usage digest, run <date>, *By feature* |
| Launches by type | <type n · …> | usage digest, *Rounds per feature* |

## What went well
- <what worked, with the evidence>

## What went wrong by class
| # | Class | What happened | Cost |
|---|-------|---------------|------|
| 1 | <a class that recurs across runs: test oracle weaker than the plan, AC detail unverified, unenumerated state, late review lens, guard blocked a needed command, …> | <what happened, with item IDs> | <rounds or tokens it cost> |

## Decisions
- <each decision taken during the run — a user answer, a sign-off, an accepted known issue, a rejected finding — with who decided and where it is recorded>

## Harness changes taken or pending
- <a change to the plugins, the project contract or the project's skills this run suggests; taken (with the commit) or pending (with the owner)>, or "None"

## Notes for the next run
- <what the next run of a similar feature should do differently>

## Plugins
| Plugin | Version |
|--------|---------|
| <name> | <version> |
```

The **Plugins** section is written from the state's `Plugins:` line, one row per
`name@version`, so each retro records the plugin versions its run ran on. A plugin written
`name@unknown` stays `unknown` — never fill it in from memory.

## Step 3 — Append the ledger row

Append **one row** to `<retros>/ledger.md`, newest last. When the file exists, compare its table
header with the header below (the `| Date | …` row and its separator). If they differ, stop: show
both headers, name the columns that differ, and ask the user how to migrate the table — never
append a row under a different header, because its cells would land under the wrong columns.
When the file does not exist, create it with this header first:

```markdown
# Run ledger

One row per finished `/sdd-engineering:run-plan` run, appended by `/sdd-engineering:workflow-retro`,
newest last. Rows are never edited; a correction is a new row with `correction of <date> <feature>`
in *Notes*. The detail of each run is in `<feature>.md` beside this file.

| Date | Feature | Spec | Plan rev · mode | Lanes | Fix rounds (budget) | First verifier run (met · partial · not met · cannot) | Final verifier run | AC met | Subagent runs | Input · output tokens | Not verified | Plugins | Retro | Notes |
|------|---------|------|-----------------|-------|---------------------|--------------------------------------------------------|--------------------|--------|---------------|-----------------------|--------------|---------|-------|-------|
```

The row fills every column from Step 1 (`Plugins` as `name@version, …`; `Retro` as a link to
the retro file). A value you could not measure is `—` with the reason in *Notes*.

## Step 4 — Report

Print the retro path, the ledger row, and the one finding class that cost the most. Ask whether
to commit the two files — never commit unasked.
