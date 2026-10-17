# Changelog

All notable changes to `architecture-review` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the plugin uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-17

### Added

- Agent `architecture-reviewer` (`opus`; Read, Grep, Glob, Bash): runs each touched package's
  `checks.<pkg>.arch` command from `.sdd/config.json`, then judges the change set against the
  onion and frontend architecture skills; severity `error` → critical, `warn` → major.
- `PreToolUse` `Bash` guard for the reviewer: read-only commands plus the configured checks.
- `SessionStart` hook: appends `{time, session_id, plugin, version}` to `.sdd/trace.jsonl` in the project.

### Dependencies

- `engineering-paved-path` `^1.0.0`.
