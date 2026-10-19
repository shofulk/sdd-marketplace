# SDD plugin set — four plugins from DevDigest's harness — design

- **Date:** 2026-10-17
- **Status:** **approved** by the user on 2026-10-17 ("Так хорошо, мне всё нравится"), after a builder
  check, the user's answers, and the catalog, trace, eval and video details ("Да, всё"). Plans:
  `docs/superpowers/plans/2026-10-17-plugins.md`, `docs/superpowers/plans/2026-10-17-catalog-ui.md`.
  Edits are made in one pass. Tags: **[user]** — the user's decision, quoted; **[measured]** — a fact
  with its source; **[assumption]** — my call, verified before it is built on where §5 says how.
- **Source:** `shofulk/dev-digest` (fork of `ai-agentic-engineering-neo/dev-digest`, MIT — GitHub API),
  read only. Every copied file gets a `NOTICE` line naming its source path.
- **Replaces** the skeleton's two plugins (`sdd-gate` ← `sdd-engineering`): the composition below is the
  course's.

## 1. What the user decided

All **[user]**, 2026-10-17, from the course slides "Крок 2" and "Крок 3" and the user's message.

- `sdd-engineering` takes **spec-creator, implementation-planner, implementer, plan-verifier**.
- **run-plan** "виконує затверджений plan", **workflow-retro** "аналізує завершений прогін".
- **researcher** and **architecture-reviewer** are dependencies:
  - `engineering-paved-path` — "постачає React, Next.js, Fastify, architecture, testing і security skills";
  - `research-tools` — "постачає read-only agent researcher";
  - `architecture-review` — "постачає generalized architecture-reviewer";
  - `sdd-engineering` — "залежить від усіх трьох plugins у range `^1.0.0`".
- Not ported: **product specs, secrets, cache, DevDigest-specific instructions**.
- `sdd-engineering` carries a **README on how it all works together** and a **file of versions and
  releases**.
- Shared skills: decide which, where, and who reuses them ("можливо, вони перевикористовуються").
- Unchanged from before: marketplace `sdd` in the public repo `shofulk/sdd-marketplace`; installed into
  `shofulk/dev-digest` by a PR; nothing is pushed, tagged, published or opened without the user's word.

Answers to the draft's questions (AskUserQuestion, 2026-10-17):
- 1.1.0 — **"Блок push в main"**, now in `sdd-engineering`'s hooks (§3.8).
- Next.js — **"Свой короткий навык"**: written from the official docs, no third-party text (§3.2, §4).
- **"Добавить ребро"**: `architecture-review` depends on `engineering-paved-path ^1.0.0` (§3.2).
- Catalog: the lecture's catalog design ("Вот пример каталога, у которого была сделана лекция. Сможем ли
  мы такое повторить?"), built with **"React + Vite"**, in English ("сделай сайт на английском") (§3.8).

### 1.1 The assignment's acceptance

As recorded on 2026-10-17: the set works without DevDigest's local files; the dependencies install and
activate with no errors in `claude plugin list --json`; a catalog page (GitHub Pages) shows the current
composition and versions; a trace or telemetry proves the active version; 1.1.0's new behaviour passes an
eval; `docs/COST-BASELINE.md` holds the cost per successful workflow before and after one optimization,
with a quality gate; a stable channel brings back the verified 1.0.0 and a smoke eval stays green; a demo
video.

## 2. What was measured

- **[measured, docs: plugins/components]** A plugin agent supports `name, description, model, effort,
  maxTurns, tools, disallowedTools, skills, memory, background, isolation, color`; it **ignores
  `permissionMode`, `hooks`, `mcpServers`** — hooks belong in the plugin's `hooks/hooks.json`.
  Components are namespaced `<plugin>:<name>`. `${CLAUDE_PLUGIN_ROOT}` is substituted inline in skill
  and agent Markdown; it is not in the Bash tool's environment (docs: manifest reference).
- **[measured, spikes on Claude Code 2.1.293]** A plugin `hooks.json` PreToolUse fires inside plugin
  subagents with `agent_type: "<plugin>:<agent>"` and blocks with `exit 2`. A bare `subagent_type` does
  not reach a plugin agent; the namespaced one does. An agent's `skills:` preloads a skill from a
  dependency plugin and from the project's `.claude/skills/`. Plugin `bin/` is on the Bash tool's PATH.
- **[measured, DevDigest `.claude/`]** The agents' frontmatter today:

  | Agent | `skills:` | Own hooks (die in a plugin) |
  |---|---|---|
  | spec-creator | spec-writing, mermaid-diagram | `scope-guard.sh write spec`, `spec-lint.mjs` pre/post, `scope-guard.sh bash readonly` |
  | implementation-planner | onion-architecture, frontend-ui-architecture | — (`permissionMode: plan`) |
  | implementer | engineering-insights, onion-architecture, frontend-ui-architecture | `implementer-guard.sh check` |
  | plan-verifier | — | `scope-guard.sh bash checks` |
  | architecture-reviewer | onion-architecture, frontend-ui-architecture | `scope-guard.sh bash checks` |
  | researcher | — | — |

- **[measured]** Lines naming DevDigest, its packages or its stack (`rg -ci` over a word list) / total:
  spec-creator 11/249, implementation-planner 27/389, implementer 23/197, plan-verifier 7/206,
  researcher 8/192, architecture-reviewer 31/199, `sdd-run` 5/334, `spec-writing` 8/153,
  `onion-architecture` 50/467, `engineering-insights` 18/111, `checks.sh` 7/143, `lane-brief.mjs`
  0/179, `harness-usage.mjs` 0/391, `implementer-guard.sh` 13/164, `spec-lint.mjs` 4/435,
  `scope-guard.sh` 233/2852.
- **[measured]** The agents read project files: `INSIGHTS.md`, `AGENTS.md`, `specs/README.md` (the spec
  template), `docs/plans/`, `.claude/scripts/{checks.sh,lane-brief.mjs}`,
  `.claude/skills/pr-self-review/{routing,severity}.md`, `.harness/{checks,retros,runs}`, `TESTING.md`.
- **[measured]** `sdd-run` also dispatches agents outside this set — `test-writer` (red lane, after
  mode), `security-reviewer`, `retro-writer`, `doc-writer` — and ends with `/pr-self-review`; its step 6
  ("run retro and ledger row") runs `harness-usage.mjs` and writes `docs/retros/<feature>.md` and a
  `docs/retros/ledger.md` row (`SKILL.md:104-148`).
- **[measured, `skills-lock.json` + GitHub API]** Origins of the stack skills: `fastify-best-practices`
  ← `mcollina/skills` (MIT); `next-best-practices` ← `vercel-labs/next-skills` (**no license** reported,
  no LICENSE file in the tree); `react-best-practices`, `react-testing-library`, `security` came with
  DevDigest's first snapshot (upstream MIT); `onion-architecture`, `frontend-ui-architecture` were written
  in DevDigest.
- **[measured, GitHub]** `vercel-labs/next-skills` now holds only a README: "`next-best-practices` is no
  longer a skill" — its knowledge ships as Next.js's bundled docs and the `AGENTS.md` that `next dev`
  writes, from Next.js 16.3. The skills moved to `vercel/next.js/skills` (MIT): `next-bundle-optimizer`,
  `next-cache-components-{adoption,optimizer}`, `next-dev-loop`,
  `next-partial-prefetching-{adoption,optimizer}`. DevDigest runs `next ^15.1.3` (`client/package.json`),
  so the bundled docs do not reach it.
- **[measured]** DevDigest parts that stay call scripts and hooks this set also ports: `pr-self-review`
  runs `checks.sh` and reads `.harness/checks/<feature>.md`; `routing.md` names `spec-lint`;
  `harness-analyst` runs `harness-usage.mjs`; test-writer, security-reviewer, doc-writer, retro-writer and
  harness-analyst use `scope-guard.sh`'s `bash readonly` / `bash checks` profiles.

## 3. Design

### 3.1 Goal, non-goals, anti-goals

Goal: in a project that has none of DevDigest's files, `/sdd-engineering:run-plan <plan>` runs an
approved plan through lanes, checks, the review round and fix rounds, and `/sdd-engineering:workflow-retro`
reports on the finished run — with every agent and skill coming from the four plugins. In DevDigest,
the same commands keep today's behaviour through the project contract (§3.4).

**[assumption]** Who it is for: projects on the paved-path stack — TypeScript, Fastify / Next.js /
React, onion layering — as "paved path" reads. The architecture preloads stay unconditional; the eval
fixture is a small project on that stack.

Non-goals: product specs, plans, retros or INSIGHTS of DevDigest; DevDigest's `pr-self-review`,
`pr-gate`, `test-writer`, `security-reviewer`, `doc-writer`, `retro-writer`, `harness-analyst` (they stay
in DevDigest); the skills not on the slide (`drizzle-orm-patterns`, `postgresql-table-design`,
`typescript-expert`, `zod` stay in DevDigest); the team; Windows.

Anti-goals: a plugin agent that names a DevDigest path, package or command; a guard that silently stops
working because it lived in agent frontmatter.

### 3.2 Repository layout

```
.claude-plugin/marketplace.json            name "sdd", four relative-path plugins
plugins/
  engineering-paved-path/                  skills only
    skills/{react-best-practices,nextjs-app-router,fastify-best-practices,
            onion-architecture,frontend-ui-architecture,react-testing-library,security}/
  research-tools/
    agents/researcher.md
  architecture-review/                     dependencies: engineering-paved-path ^1.0.0  [user]
    agents/architecture-reviewer.md
    hooks/hooks.json, scripts/bash-guard.*  its Bash guard, keyed by agent_type
  sdd-engineering/                         dependencies: the three, each ^1.0.0
    agents/{spec-creator,implementation-planner,implementer,plan-verifier}.md
    skills/{run-plan,workflow-retro,spec-writing,mermaid-diagram}/
    hooks/hooks.json                        guards + spec-lint, keyed by agent_type (§3.5)
    scripts/{checks,lane-brief,usage,...}   ported checks.sh, lane-brief.mjs, harness-usage.mjs
    README.md                               how the four work together (§3.7)
    CHANGELOG.md                            versions and releases
  each plugin: .claude-plugin/plugin.json, README.md, CHANGELOG.md, NOTICE, tests/ or evals/,
               hooks/hooks.json with its SessionStart trace hook (§3.8)
site/                                      the catalog: React + Vite app, its own package.json (§3.8)
  scripts/build-catalog.mjs                writes public/catalog.json from the plugin files
.github/workflows/pages.yml                builds and deploys it
docs/specs/, docs/COST-BASELINE.md, docs/evals/ (saved eval JSON reports)
```

**[assumption]** Shared skills: the two architecture skills are preloaded by the planner, the implementer
and the reviewer, so they live in `engineering-paved-path`; `architecture-review` depends on it too, so
the reviewer's preloads resolve when it is installed alone (**[user]**, "Добавить ребро"). The graph has
four edges: the slide's three and this one. `nextjs-app-router` is new: App Router, RSC boundaries and
data fetching for Next.js 15, written from nextjs.org/docs with links, no copied text. `spec-writing` and
`mermaid-diagram` serve only spec-creator, so they ship with it. `engineering-insights` is DevDigest's
INSIGHTS protocol — a DevDigest-specific instruction — and stays there (§3.4).

### 3.3 Generalizing the agents and skills

The four "not ported" classes, as they show up in DevDigest:
- **Product specs** — `specs/*.spec.md`, `<pkg>/.spec/`, `docs/plans/*.plan.md`, `docs/retros/`.
- **Secrets** — `.mcp.json`, `.claude/settings.local.json`, any `.env`.
- **Cache** — `.harness/`, `.pr-review/`, `evals/` runs; in this set's own terms, `.sdd/` except
  `config.json`.
- **DevDigest-specific instructions** — package names (`server/`, `client/`, `reviewer-core/`, `e2e/`,
  `mcp-server/`), `pnpm --dir …` commands, the `server/src` ring map, `INSIGHTS.md`, `AGENTS.md`,
  `TESTING.md`, the `.claude/...` paths of hooks and scripts.

Rules: a path inside the plugin becomes `${CLAUDE_PLUGIN_ROOT}/...`; a project path or command comes from
the project contract (§3.4); an agent dispatched by a skill is named `<plugin>:<agent>`; generic templates
the agents need (the spec template behind `specs/README.md`, the plan and retro shapes) ship inside the
plugin. `onion-architecture` keeps its rules and loses DevDigest's ring map, which stays in DevDigest.

### 3.4 The project contract

**[assumption]** One optional file in the host project, `.sdd/config.json`, read by the skills, the
agents and the scripts. It stays outside `.claude/` because an eval run reads no project `.claude/`
directory, even one a scaffold wrote (**[measured, docs: plugin-evals]**); `.sdd/` also holds the run
state and the trace (§3.8), and the host gitignores everything in it but `config.json`. Keys:

- `context` — files every agent reads first (DevDigest: `["INSIGHTS.md", "AGENTS.md"]`);
- `specs`, `plans`, `runs` — where specs, plans and run state live (defaults `specs/`, `docs/plans/`,
  `.sdd/runs/`);
- `checks` — per package, the typecheck / lint / test / arch commands `checks` runs and the Bash guards
  allow;
- `routing` — the project's file → skill table, if it has one (DevDigest: its `pr-self-review/routing.md`);
- `agents` — optional project agents run-plan uses when present (DevDigest: `test-writer`,
  `security-reviewer`, `doc-writer`, `retro-writer`);
- `skills` — per plugin agent, project skills run-plan names in its brief; an agent with the `Skill`
  tool loads them (DevDigest: implementer ← `engineering-insights`, its read-before / append-after
  protocol). The read-only agents have no `Skill` tool and get `context` only.

Without the file the defaults apply, `checks` asks the user for the commands once, and the optional
phases are skipped. The exact keys are the builder's.

### 3.5 Guards

Each plugin restores its own agents' guards in its `hooks/hooks.json`, matching `agent_type`:
- `sdd-engineering`: spec-creator writes only spec files, every write passes `spec-lint`, and its Bash
  is read-only (`write spec`, `bash readonly`); implementer's Bash guard (no commit, push, migration —
  from `implementer-guard.sh`); plan-verifier's read-only Bash with the `checks` commands
  (`bash checks`). **[assumption]** The planner's `permissionMode: plan` is ignored in a plugin, so it
  gets `bash readonly`.
- `architecture-review`: the reviewer's read-only Bash guard with the `checks` commands.
- `research-tools`: none — the researcher has none in DevDigest and no Write/Edit tools.

Only the profiles these agents use are ported from `scope-guard.sh` (`write spec`, `bash readonly`,
`bash checks`), each with its self-test. Guards fail open on their own errors, as DevDigest's do.

### 3.6 run-plan and workflow-retro

- **run-plan** = `sdd-run` minus DevDigest: same phases (lanes interface → red tests → implementation,
  the checks gate, manual acceptance, the parallel review round, fix rounds with a budget, `--resume`,
  `--from`). It dispatches `sdd-engineering:implementer`, `sdd-engineering:plan-verifier`,
  `architecture-review:architecture-reviewer` and, when research is needed, `research-tools:researcher`.
  **[assumption]** A phase whose agent is optional runs only when the project names it in `agents`:
  with no `test-writer`, the implementer writes the red tests in L2; with no `security-reviewer`, the
  review round is architecture + plan; with no `retro-writer`, only the round budget stops the fix loop
  (its `Converging: no` stops it today, `sdd-run/SKILL.md:113-115`); at the end it calls the project's
  `/pr-self-review` if one exists.
- **workflow-retro** = `sdd-run`'s step 6 as its own skill, run on a finished run: reads the run's state
  and reports, runs the ported `usage` script over the run's transcripts, writes the retro (outcome, what
  went well, what went wrong by class, decisions, the plugin versions the run used — §3.8) and a ledger
  row. Where they go comes from §3.4.

### 3.7 README and the releases file

`plugins/sdd-engineering/README.md`: the four plugins and their dependency graph, the flow (spec-creator →
implementation-planner → run-plan → workflow-retro) with which plugin supplies each step, the project
contract, install and the stable channel, the guards. Every plugin has a `CHANGELOG.md` (Keep a
Changelog); `sdd-engineering`'s also lists, per release, the dependency versions it was verified with.

### 3.8 Versions, channels, trace, evals, cost, catalog

- All four start at **1.0.0**. Tags `<name>--v<version>` with `claude plugin tag --push`, the three
  dependencies before `sdd-engineering` (a range resolves against existing tags — docs).
- **Stable channel [assumption, C2]**: a second marketplace file whose entries pin release tags
  (`{source: "github", repo, ref: "<name>--v1.0.0"}`), added through the settings `path` field (the
  schema allows `ref` and `path` on a github source); latest is the root file with relative paths.
  DevDigest pins stable. **[measured, docs]** Claude Code has no release-channel concept and documents no
  downgrade command, so the rollback rehearsal is: 1.0.0 from stable → latest, update to 1.1.0 → back
  to stable → `claude plugin list --json` shows 1.0.0 → smoke eval green.
- **Trace — the active version.**
  - Each of the four plugins ships a SessionStart hook that appends `{time, session_id, plugin, version}`
    to `$CLAUDE_PROJECT_DIR/.sdd/trace.jsonl`. The version is read from `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`,
    the installed copy that actually loaded. **[measured, docs]** `${CLAUDE_PLUGIN_ROOT}` names only the
    plugin's own installed version, so one plugin cannot read the others' — hence a hook in each.
    `${CLAUDE_PLUGIN_DATA}` is per plugin and outside the project, so the trace goes to the project.
  - run-plan writes the four versions into the run's state; workflow-retro prints them in the retro,
    so each workflow run carries the versions it ran on.
  - Three sources are compared: `.sdd/trace.jsonl`, the `-p` stream-json `init` that lists each plugin
    with its `version` (**[measured, S9]**), and `claude plugin list --json`. OTEL
    `claude_code.plugin_loaded` with `plugin.version` (`OTEL_LOG_TOOL_DETAILS=1`, docs) is optional.
    After the rollback all three show 1.0.0.
- **Evals** (`claude plugin eval`, **[measured, docs: plugin-evals]**): each run is a `claude -p` child
  with only the listed plugins loaded — other installed plugins, user settings and project `.claude/`
  are absent — and the plugin's hooks and agents load. Graders are `regex` (over the last message, the
  session `trace` or a workspace file), `tool_used`, `tool_order`, `file_exists`, `llm`, `baseline`;
  "there are no custom-code graders". A case runs three times by default, plus as many without the
  plugin unless `--ablation none`. A granted Bash runs in the OS sandbox and writes only in the
  workspace. A `scaffold_script` builds the fixture (with `--scaffold`, 120 s). The JSON carries
  `aggregates.casesPassed`, `casesTotal`, `costUsd`, `claudeVersion`.
  - Every case sets `plugins:` to the four plugin directories, so the dependencies load.
  - Cases: **smoke** (`tags: [smoke]`: the four plugins load and `/sdd-engineering:run-plan` is
    reachable — `tool_used: Skill` with `input_match: run-plan`), **run-plan** (a fixture plan of two or
    three ACs → plan-verifier reports every AC met and the checks pass; graded by `regex` over the run's
    verification file), **1.1.0** (below), plus the guard self-tests outside `plugin eval`.
  - The JSON reports of every run cited in the course write-up are saved in `docs/evals/`.
- **Cost**: a successful workflow is one passing run-plan case; cost per success = `costUsd` /
  `casesPassed` over N runs, or `total_cost_usd` of `claude -p --output-format json`, which includes
  subagents (measured). The quality gate: after the optimization the pass rate on the same N is not
  lower. One baseline run comes first; its measured cost sets N with the user. The optimization is
  chosen after the baseline, from what it shows.
- **Catalog — the current composition and versions** (**[user]**: the lecture's design, React + Vite,
  English UI text).
  - **Screens**, as in the lecture's design:
    - home — search, keyword tags, counts per kind, "what's new";
    - search — filters by kind and keyword, sorting;
    - plugin page — composition, dependencies, README, Changelog, the install command, the latest and
      the stable version;
    - component page (skill, agent, hook) — how to invoke it (`/sdd-engineering:run-plan`,
      `@agent-sdd-engineering:implementer`), tools, model, the first paragraphs of its body;
    - getting started — add the marketplace, install, the stable channel, switching channels (added
      2026-10-19, from the rollback rehearsal);
    - what's new.

    Also a ⌘K palette, a light/dark theme, copy buttons, and the build's commit SHA and time.
  - **Data**, none written by hand: `site/scripts/build-catalog.mjs` writes `site/public/catalog.json`
    from `marketplace.json`, the stable marketplace file, each `plugin.json` (name, displayName,
    version, author, keywords, description, dependencies), a scan of each plugin's `agents/`, `skills/`
    and `hooks/hooks.json` (frontmatter `name`, `description`, `tools`, `model`; hook events), its
    `README.md` and its `CHANGELOG.md`. **[measured, docs]** Components are found by directory;
    `plugin.json` does not list them.
  - **Stack**: a React + Vite single-page app in `site/` with its own `package.json`, so the plugin
    directories carry no Node dependencies. **[measured, docs]** GitHub Pages serves static files only
    and has no single-page fallback, so routing uses `HashRouter`; Vite's `base` is
    `/sdd-marketplace/` for the project-page subpath. Search runs in the browser over `catalog.json`
    (the library is the builder's).
  - **CI**: `.github/workflows/pages.yml` runs on every push to `main` (tag pushes dropped on
    2026-10-19: the `github-pages` environment deploys only from `main`, and a release pushes it):
    `build-catalog` → `npm ci && vite build` → the Pages deploy action. **[measured, docs: GitHub
    Pages]** A branch deploy serves only `/` or `/docs`, so `site/` needs the Actions deploy. The build
    fails if a version in `catalog.json` differs from its `plugin.json`.
  - Turning Pages on is an outward action: on the user's word.
- **1.1.0** (**[user]**, "Блок push в main"): `sdd-engineering`'s `hooks.json` blocks a `git push` to
  the default branch from any Claude Code session, main thread or subagent.
  - **[assumption]** What counts: a refspec ending in the default branch (`main`, `HEAD:main`, `+main`,
    `refs/heads/main`), `--all`, `--mirror`, or no refspec while the current branch is the default one.
    The default branch is `refs/remotes/<remote>/HEAD`, else `main`. Pushes of other branches pass.
  - `--no-verify` changes nothing: the check is Claude Code's PreToolUse hook, not git's. **[measured]**
    DevDigest's `pre-push` (`.claude/hooks/pre-push:24`) gates every push but is installed by hand per
    clone (`:4-5`) and skipped by `--no-verify` (`:7-8`); it stays as it is. Pushes from a terminal
    outside Claude Code stay outside the hook.
  - Only `sdd-engineering` goes to 1.1.0; its dependencies stay at 1.0.0 inside `^1.0.0`. Tag
    `sdd-engineering--v1.1.0`.
  - Tests: deterministic cases (push to `main` → block; with `--no-verify` → block; `HEAD:main` from a
    feature branch → block; a feature branch → pass).
  - The eval case (`tags: [v1.1.0]`, run with `--scaffold --allow-tools Bash --ablation none`): the
    scaffold makes a git repository and a bare remote inside the workspace with `main` and
    `origin/HEAD`; the prompt asks to commit a change, push it to `main`, and write the output of
    `git ls-remote origin main` to `result.txt`. Graders, none of them a judge: `tool_used` Bash with
    `input_match: git push` (the push was tried); `regex` over `trace` for the hook's block marker
    (e.g. `SDD-PUSH-BLOCKED`); `regex` over `result.txt` for the fixture's initial SHA (`main`
    unchanged).
  - The proof: the same case run against a checkout of `sdd-engineering--v1.0.0` (a git worktree at
    the tag) scores 0/1, against 1.1.0 scores 1/1; both JSON reports go to `docs/evals/`.

### 3.9 The install PR in DevDigest

- `.claude/settings.json`: the marketplace (stable channel) and `enabledPlugins` for `sdd-engineering`
  (its dependencies install with it).
- Removed: the agents and skills the plugins now ship (the six agents, `sdd-run`, `spec-writing`, the
  paved-path skills) — **[assumption]** but nothing a remaining DevDigest part calls by path:
  `.claude/hooks/` and `.claude/scripts/` stay whole (§2: `pr-self-review`, `routing.md`,
  `harness-analyst` and five agents use them). The duplicate copies are accepted; the plugin's scripts
  are not a public interface. `mermaid-diagram` and any skill a remaining agent preloads go only if C4
  holds. DevDigest's `.sdd/config.json` points the checks record at `.harness/checks/` so `pr-self-review` can
  reuse it if the record format matches (the builder's).
- Added: `.sdd/config.json` (§3.4) and the `.gitignore` lines for the rest of `.sdd/`; DevDigest's ring
  map as a project skill or an `AGENTS.md` section.
- DevDigest's remaining agents name the plugin agents and skills they use by namespaced name;
  `routing.md` loses `vercel-react-best-practices`, `doc-standards`, `file-conventions` (**[user]**,
  "Убрать из routing в PR").
- Rollback: revert the PR.

### 3.10 The demo video

One take, each step showing the evidence named for it:
1. Add the marketplace and install `sdd-engineering` from the stable channel — the three dependencies
   come with it.
2. `claude plugin list --json`: four plugins, enabled, no errors.
3. The catalog page: composition, latest and stable versions, the build's commit SHA.
4. In DevDigest, a small feature: spec-creator → implementation-planner → `/sdd-engineering:run-plan` →
   `/sdd-engineering:workflow-retro`.
5. The trace: `.sdd/trace.jsonl`, the stream-json `init` and the retro agree on the versions.
6. Switch to latest, update to 1.1.0, the 1.1.0 eval report: 0/1 on 1.0.0, 1/1 on 1.1.0.
7. Back to stable: `claude plugin list --json` shows 1.0.0, the smoke eval is green.

## 4. Constraints

- DevDigest's `next-best-practices` (from `vercel-labs/next-skills`, no license, withdrawn upstream —
  §2) is not copied into the public repository; the install PR leaves DevDigest's local copy alone.
- The lecture's catalog is a design reference only: its generated runtime (`support.js`, "GENERATED from
  dc-runtime … do not edit", license unknown) and its sample plugins are not copied; the screens are
  re-implemented in React.
- No DevDigest product file, secret or cache enters this repository; a check before each commit greps for
  the package names in §3.3.
- Every claim in the course write-up comes from a run — tests, eval JSON, `claude plugin list --json`,
  the trace file.

## 5. Assumptions — verify before building on them

| # | Assumption | How to verify | If wrong |
|---|---|---|---|
| C1 | A plugin hook's block shows in the eval run's `trace`, so a `regex` grader sees it (the docs say hooks load in eval; the trace content is unmeasured) | one case on a draft plugin whose hook blocks a command | grade the 1.1.0 case by `result.txt` and `tool_used` only |
| C2 | A second marketplace file via the settings `path` field works as the stable channel | both channels in a scratch project | a `stable` branch with its own marketplace name |
| C3 | An agent whose `skills:` names a skill absent from the session still loads and runs | a scratch plugin agent preloading a missing skill | the plugin agents preload only skills the plugins ship |
| C4 | A project agent's `skills:` resolves a plugin skill by its namespaced name | a DevDigest agent preloading `engineering-paved-path:security` | DevDigest keeps local copies of the skills its own agents preload |
| C5 | `^1.0.0` dependencies across four plugins resolve and enable with no error | install from a local marketplace, `claude plugin list --json` | pin exact versions |
| C6 | The eval sandbox can push to a local bare remote the scaffold makes | part of C1 | the 1.1.0 behaviour is covered by its deterministic cases only |
| C7 | A plugin's SessionStart hook fires in an interactive session, in `claude -p` and in an eval run, with `CLAUDE_PROJECT_DIR` set | a draft plugin whose hook appends a line, run all three ways | the trace comes from the stream-json `init` and `claude plugin list --json` only |
| C8 | A smoke case run against the installed stable copy (`claude plugin eval sdd-engineering@<stable marketplace>`) loads the dependencies | the rollback rehearsal | run the smoke case from a worktree at the 1.0.0 tags |

## 6. Order

1. C1–C7 spikes in a scratch directory (C8 runs inside the rollback rehearsal).
2. `engineering-paved-path` and `research-tools` (copies + generalization), then `architecture-review`,
   then `sdd-engineering`; `claude plugin validate --strict` and the self-tests green at each step.
3. A local DevDigest branch with `--plugin-dir`: spec → plan → run-plan → workflow-retro end to end.
4. Evals, the cost baseline and one optimization.
5. On the user's word: push, tag 1.0.0, the install PR.
6. 1.1.0, its eval, the channel switch and the rollback rehearsal; the catalog page; the video.
