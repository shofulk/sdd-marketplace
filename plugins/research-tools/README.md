# research-tools

The read-only `researcher` agent. Part of the `sdd` marketplace; `sdd-engineering` depends on it.

## Agent

`research-tools:researcher` (model `sonnet`; tools Read, Grep, Glob, Bash, WebSearch, WebFetch,
AskUserQuestion; no Write, Edit or Skill) answers one concrete question with evidence:

- **(A) in-repo** — where and how something is implemented, which conventions apply, why it
  changed (git history);
- **(B) external** — official docs, APIs, library behaviour, standards, versions, pinned to the
  version the project uses.

It first checks that the request has a concrete question, a type, a scope and a done criterion;
when one is missing it returns clarifying questions (as an `AskUserQuestion` payload when it runs
as a subagent) and does no research. Reports cite `path:line`, a commit or a quoted URL for every
finding, and list what was searched and not found.

In a project with `.sdd/config.json`, it reads the files under `context` before searching.

Who uses it: `sdd-engineering:spec-creator` asks the main session for researcher runs when
reading is not enough, and `/sdd-engineering:run-plan` dispatches it when a phase needs research.
Call it directly with `@agent-research-tools:researcher` or `claude --agent research-tools:researcher`.

## Hooks

`SessionStart`: appends `{time, session_id, plugin, version}` to `.sdd/trace.jsonl` in the
project. The researcher has no Bash guard: it has no write tools, and its prompt limits Bash to
read-only commands.

## Sources

See `NOTICE`.
