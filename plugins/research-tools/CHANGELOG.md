# Changelog

All notable changes to `research-tools` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the plugin uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-17

### Added

- Agent `researcher` (`sonnet`; Read, Grep, Glob, Bash, WebSearch, WebFetch, AskUserQuestion; no
  write tools): in-repo and external questions with a clarify gate, cited evidence and a "not
  found" list; reads the `.sdd/config.json` `context` files first.
- `SessionStart` hook: appends `{time, session_id, plugin, version}` to `.sdd/trace.jsonl` in the project.
