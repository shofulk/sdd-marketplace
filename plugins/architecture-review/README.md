# architecture-review

The read-only `architecture-reviewer` agent. Part of the `sdd` marketplace; depends on
`engineering-paved-path` (`^1.0.0`) for the two architecture skills it preloads, and
`sdd-engineering` depends on it.

## Agent

`architecture-review:architecture-reviewer` (model `opus`; tools Read, Grep, Glob, Bash;
preloads `engineering-paved-path:onion-architecture` and
`engineering-paved-path:frontend-ui-architecture`) reviews one change set:

1. runs each touched package's `checks.<pkg>.arch` command from `.sdd/config.json` (or reads
   a fresh checks record) and compares the counts with the project's recorded baseline;
2. checks mirrors, package independence and core-package purity;
3. judges changed backend files against the onion review checklist and changed frontend files
   against the frontend-ui-architecture authority tiers.

Each finding carries the rule, `file:line`, the import edge and its ring, severity and
evidence. Severity: an `arch` `error` → critical, a `warn` whose count rose → major; judged
findings critical / major / minor. It never proposes fixes and never judges style,
performance or security.

Who uses it: `/sdd-engineering:run-plan` dispatches it in the review round. Call it directly with
`@agent-architecture-review:architecture-reviewer`.

## Hooks

- `PreToolUse` `Bash`: `hooks/lib/bash-guard.mjs checks --agents architecture-review:architecture-reviewer`
  — for this agent only, Bash is read-only plus the exact `checks` commands from
  `.sdd/config.json`, run from the project root. Other agents and the main session are not
  affected. The guard fails open on its own errors.
- `SessionStart`: appends `{time, session_id, plugin, version}` to `.sdd/trace.jsonl`.

## Sources

See `NOTICE`.
