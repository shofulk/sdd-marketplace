# Changelog

All notable changes to `sdd-engineering` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the plugin uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-10-18

### Fixed

- `/sdd-engineering:workflow-retro` compares an existing `ledger.md` table header with its own
  and stops on a difference, showing both headers, instead of appending a row whose cells land
  under the wrong columns (found when installing into a project whose ledger had 14 columns).

### Changed

- README, *The stable channel*: the project settings example enables the three dependencies
  too (the form `claude plugin install --scope project` writes); project settings do not install
  the plugins in a `claude -p` session, so the README gives the two install commands;
  `claude plugin marketplace remove` also clears the project's plugin settings; the `stable`
  branch exists and moves after a release's smoke eval.

## [1.0.0] - 2026-10-17

### Added

- Agents `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`.
- Skill `/sdd-engineering:run-plan`: lanes (interface → red tests → implementation), the checks gate,
  manual acceptance, the parallel review round and budgeted fix rounds, `--resume` / `--from`;
  optional project agents (`test-writer`, `security-reviewer`, `retro-writer`, `doc-writer`) with
  fallbacks; the run state records the four plugin versions.
- Skill `/sdd-engineering:workflow-retro`: the retro of a finished run and one ledger row, with the
  plugin versions the run used.
- Skills `spec-writing` (with the spec template and a reference example) and `mermaid-diagram`,
  preloaded by `spec-creator`.
- Scripts `checks.mjs` (recorded checks gate with a tree fingerprint, `changes`), `lane-brief.mjs`,
  `usage.mjs`.
- Hooks: per-agent Bash guards (`readonly` for spec-creator and implementation-planner, `checks` for
  plan-verifier, `implementer` deny-list), `spec-guard` (spec-creator writes only draft spec
  files), `spec-lint` (spec format on every write; blocks approving a broken spec).
- `SessionStart` hook: appends `{time, session_id, plugin, version}` to `.sdd/trace.jsonl` in the project.
- The project contract `.sdd/config.json` (`context`, `specs`, `plans`, `runs`, `checks`,
  `checksDir`, `retros`, `routing`, `agents`, `skills`).

### Dependencies

Verified with:

| Plugin | Range | Version |
|--------|-------|---------|
| `engineering-paved-path` | `^1.0.0` | 1.0.0 |
| `research-tools` | `^1.0.0` | 1.0.0 |
| `architecture-review` | `^1.0.0` | 1.0.0 |
