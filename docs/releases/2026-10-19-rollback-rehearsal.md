# Rollback rehearsal — stable 1.0.1 → latest 1.1.0 → stable 1.0.1

- **Date:** 2026-10-19
- **Spec:** `docs/specs/2026-10-17-plugin-set-design.md` §3.8 (the rehearsal), §5 C8, §3.10
  steps 6–7.
- **Environment:** Claude Code 2.1.293, macOS. A scratch `CLAUDE_CONFIG_DIR` and an empty git
  project (`proj/`, branch `main`), so no user setting or plugin cache changed. Installs came from
  GitHub over SSH: `main` at `6fd0570` (latest), `stable` at `691d8d3`.
- **Channels at the time:** latest `sdd-engineering` 1.1.0 (tag `sdd-engineering--v1.1.0`), stable
  `sdd-engineering` 1.0.1; the three dependencies are 1.0.0 on both.
- **Spend:** $0.13 (the smoke eval). The `claude -p` runs were not logged in and cost $0; their
  SessionStart hooks and `init` message still ran.

Claude Code has no channel switch and no downgrade command. Moving between channels is uninstall,
prune, install from the other catalog.

## R1 — install from stable

```text
claude plugin marketplace add shofulk/sdd-marketplace#stable
claude plugin install sdd-engineering@sdd-stable --scope project
```

`+ 3 dependencies: engineering-paved-path, research-tools, architecture-review`.
`plugin list --json` exit 0, empty stderr, four plugins enabled at project scope, every `errors`
empty.

## R2 — switch to latest, update to 1.1.0

```text
claude plugin marketplace add shofulk/sdd-marketplace
claude plugin uninstall sdd-engineering@sdd-stable --scope project
claude plugin prune --scope project -y
claude plugin install sdd-engineering@sdd --scope project
```

Measured on the way:

- `uninstall` removes `sdd-engineering` only; its three dependencies stay installed and enabled
  (`3 auto-installed dependencies no longer needed … Run claude plugin prune`).
- `prune` without `-y` outside a terminal lists them and removes nothing (`Not a TTY — run … -y`).
  Installing latest before the prune left seven plugins enabled: the three `@sdd-stable`
  dependencies beside the four `@sdd` ones. `prune --scope project -y` removed the three.

The installed 1.1.0 copy (`cache/sdd/sdd-engineering/1.1.0/hooks/push-guard.mjs`) given a hook
payload for `git push origin main` in `proj/`: exit 2,
`SDD-PUSH-BLOCKED: the refspec main updates main, the default branch. …`; for
`git push origin feat/x`: exit 0.

## R3 — back to stable

```text
claude plugin uninstall sdd-engineering@sdd --scope project
claude plugin prune --scope project -y
claude plugin install sdd-engineering@sdd-stable --scope project
```

The installed stable copy (`cache/sdd-stable/sdd-engineering/1.0.1/hooks/`) holds no
`push-guard.mjs`, and its `hooks.json` names none.

## The three sources at each step

| Step | `claude plugin list --json` | stream-json `init` | `.sdd/trace.jsonl` |
|---|---|---|---|
| R1 stable | `sdd-engineering@sdd-stable` 1.0.1; deps `1.0.0-b0d269b4b139` | sdd-engineering 1.0.1, deps 1.0.0 | sdd-engineering 1.0.1, deps 1.0.0 |
| R2 latest | `sdd-engineering@sdd` 1.1.0; deps `1.0.0-b0d269b4b139` | sdd-engineering 1.1.0, deps 1.0.0 | sdd-engineering 1.1.0, deps 1.0.0 |
| R3 stable | `sdd-engineering@sdd-stable` 1.0.1; deps `1.0.0-b0d269b4b139` | sdd-engineering 1.0.1, deps 1.0.0 | sdd-engineering 1.0.1, deps 1.0.0 |

The dependencies' list version is tag-resolved (`<version>-<commit>`), as in the spikes; `init` and
the trace read their `plugin.json`. Each trace row set shares one `session_id`.

## Smoke eval after the rollback

C8 (`claude plugin eval sdd-engineering@sdd-stable`) is **wrong**: the case loads, then
`plugins entry "../../../engineering-paved-path" does not exist` — the installed cache is laid out
`<marketplace>/<plugin>/<version>/`, so the case's relative dependency paths miss. Fallback: the
four installed stable copies (the bytes from `plugin list`'s `installPath`) copied side by side
under their plugin names, and the smoke case run on them:

```text
claude plugin eval plugins --eval-dir sdd-engineering/evals --case smoke --scaffold \
  --allow-tools Read Glob Grep --ablation none --runs 1 --trust-plugin --no-publish
```

1/1, 7/7 graders, sdd-engineering 1.0.1 with the three at 1.0.0, $0.13 —
`docs/evals/2026-10-19-smoke-stable-after-rollback.json`.

## What this does not show

- An interactive session's trust prompt and plugin loading (C7's interactive leg is the user's).
- A project that declares the plugins only in `.claude/settings.json`: `claude -p` does not install
  them from there (measured 2026-10-18), so every step above installs explicitly.
