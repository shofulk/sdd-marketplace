# Changelog

All notable changes to `sdd-engineering` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the plugin uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
