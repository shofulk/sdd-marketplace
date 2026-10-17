# Changelog

All notable changes to `engineering-paved-path` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the plugin uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-17

### Added

- Skills `onion-architecture` (rings, per-tool rules, a dependency-cruiser enforcement template,
  review checklist — without any project's ring map) and `frontend-ui-architecture`, preloaded by
  `architecture-review:architecture-reviewer`, `sdd-engineering:implementation-planner` and
  `sdd-engineering:implementer`.
- Skill `nextjs-app-router`: Next.js 15 App Router rules written from the official docs, every rule
  linked.
- Skills `react-best-practices`, `react-testing-library`, `fastify-best-practices`, `security`.
- `SessionStart` hook: appends `{time, session_id, plugin, version}` to `.sdd/trace.jsonl` in the project.
