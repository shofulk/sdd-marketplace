# Catalog UI (Track A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The marketplace catalog site in `site/` — a React + Vite single-page app in the lecture's design, English text, whose every fact comes from `catalog.json` that `build-catalog.mjs` generates from the plugin files — plus the GitHub Actions workflow that builds and deploys it to Pages.

**Architecture:** `site/scripts/build-catalog.mjs` reads the repository's marketplace and plugin files and writes `site/public/catalog.json`. The app fetches that file at runtime and renders six screens under a `HashRouter`. Pure logic (search scoring, graph layout, Markdown excerpts) lives in small modules with unit tests; screens get React Testing Library tests against a fixture catalog.

**Tech Stack:** Node 22 (the current `vitest` and `jsdom` require ≥ 22.12 and ≥ 22.22.2 — `npm view <pkg> engines`, measured 2026-10-17; `site/.nvmrc` holds `22`), React (current stable major), Vite, TypeScript, `react-router-dom` (`HashRouter`), `react-markdown`, `yaml`, Vitest + React Testing Library + jsdom. Exact versions are whatever `npm install` resolves on the day; commit `package-lock.json`.

**Spec:** `docs/specs/2026-10-17-plugin-set-design.md` (approved), §3.8 *Catalog* and §1. Read it first.

**Design reference:** the throwaway prototype (English, version 2) whose local path the kickoff gives. Match its layout, tokens, screens and copy; do not copy its hard-coded data.

## Global Constraints

- UI text in English (spec §1: "сделай сайт на английском").
- React + Vite in `site/` with its own `package.json`; nothing under `plugins/` gains a Node dependency.
- `HashRouter`; Vite `base: '/sdd-marketplace/'` (spec §3.8: Pages has no single-page fallback; project-page subpath).
- No plugin, version or component is written by hand in the app: everything comes from `catalog.json`.
- The lecture's catalog is a design reference only: its `support.js` runtime and sample plugins are not copied (spec §4).
- Screens (spec §3.8): home, search, plugin page, component page, getting started, what's new; ⌘K palette, light/dark theme, copy buttons, the build's commit SHA and time.
- Fonts IBM Plex Sans and IBM Plex Mono from Google Fonts with system fallbacks; colors as CSS tokens with light and dark values, dark first, as in the prototype.
- The CI workflow runs on every push to `main` and every tag push: `build-catalog` → `npm ci && vite build` → the Pages deploy action (spec §3.8).
- Install command shape: `/plugin install <plugin>@<marketplace>`; marketplace add: `/plugin marketplace add <owner>/<repo>`.
- Work happens on this track's branch in its own worktree. Commit after each task, locally; no push, no GitHub repository, Pages not enabled. Commit messages carry no attribution lines.
- Touch only `site/`, `.github/workflows/pages.yml` and `.gitignore` (add `site/dist/` and `site/public/catalog.json`). Track B owns `plugins/`, `.claude-plugin/`, `tools/`, `tests/`, root `package.json` and root `README.md`.

## Review Focus

- A plugin with no README, no CHANGELOG or no components → its page renders with an empty-state line for that section, no crash. Test: A2 (build) and A5 (page).
- The URL names a plugin or component that does not exist (`#/plugin/nope`) → a "not found" screen with a link home, not a blank page. Test: A7.
- `catalog.json` fails to load (404 or invalid JSON) → an error screen that says the catalog could not be loaded. Test: A1.
- The clipboard API rejects → a status message asking the reader to select the text by hand. Test: A4.
- No stable marketplace file (nothing released yet) → plugins show "stable: not released" instead of a version. Test: A2 and A5.

## Cross-track interface (what this track reads, Track B produces)

`.claude-plugin/marketplace.json` (`name`, `owner`, `description`, `plugins[].name/source`); per plugin `.claude-plugin/plugin.json` (`name, displayName, version, description, author.name, keywords, dependencies[{name, version}], repository`); `agents/*.md` frontmatter `name, description, tools, model, skills`; `skills/<name>/SKILL.md` frontmatter `name, description`, optional `user-invocable: false`; `hooks/hooks.json`; `README.md`; `CHANGELOG.md` (Keep a Changelog). The stable marketplace file defaults to `.claude-plugin/stable/marketplace.json`, its entries carrying `source.ref` = `<plugin>--v<version>`. Until Track B lands, the repository holds an older skeleton: the build must work on it with warnings, and the tests use their own fixture.

## File structure

```
site/package.json, vite.config.ts, tsconfig.json, index.html, README.md          (A1)
site/src/main.tsx, App.tsx, types.ts, data/useCatalog.ts, styles/tokens.css     (A1)
site/scripts/build-catalog.mjs, site/test/fixtures/repo/…, site/test/build-catalog.test.ts   (A2)
site/src/lib/search.ts, lib/graph.ts, lib/copy.ts                                (A3, A4)
site/src/screens/{Home,Search,PluginPage,ComponentPage,Start,News,NotFound}.tsx  (A3–A7)
site/src/components/{Header,Footer,Palette,Graph,Card,KindBadge,CopyButton}.tsx  (A3–A7)
.github/workflows/pages.yml, site/test/pages-workflow.test.ts                    (A8)
```

## The catalog contract (`site/src/types.ts`)

```ts
export type Kind = 'skill' | 'agent' | 'hook';
export interface Catalog {
  marketplace: { name: string; owner: string; description: string; repo: string | null }; // repo "owner/name"
  build: { sha: string; builtAt: string };                 // ISO time
  plugins: Plugin[];
  warnings: string[];
}
export interface Plugin {
  name: string; displayName: string; description: string; author: string; keywords: string[];
  version: string;                                         // plugin.json version = latest
  stableVersion: string | null;                            // from the stable file's ref; null = not released
  dependencies: { name: string; range: string | null }[];
  readme: string | null;                                   // Markdown
  changelog: { version: string; date: string | null; summary: string }[];  // newest first, no Unreleased
  components: Component[];
  path: string;                                            // "plugins/<name>"
}
export interface Component {
  kind: Kind; name: string; description: string;
  invocation: string | null;   // skill "/<plugin>:<name>" unless user-invocable false; agent "@agent-<plugin>:<name>"; hook null
  tools: string[]; model: string | null; skills: string[];
  events: string[];            // hooks: event names from hooks.json; others []
  excerpt: string;             // first two non-heading paragraphs of the Markdown body
  path: string;
}
```

---

### Task A1: Scaffold, routing, catalog loading

**Files:** Create `site/.nvmrc` (`22`), `site/package.json` (`"engines": {"node": ">=22.22.2"}`; scripts: `catalog` = `node scripts/build-catalog.mjs --root .. --out public/catalog.json`, `dev` = `npm run catalog && vite`, `build` = `npm run catalog && tsc -b && vite build`, `test` = `vitest run`), `vite.config.ts` (`base: '/sdd-marketplace/'`, Vitest `environment: 'jsdom'`), `tsconfig.json`, `index.html` (title `SDD Marketplace Catalog`, Google Fonts link), `src/main.tsx`, `src/App.tsx`, `src/types.ts`, `src/data/useCatalog.ts`, `src/styles/tokens.css`, `src/test/catalog.fixture.ts`, `src/App.test.tsx`; modify `.gitignore`.

**Interfaces:** Produces `useCatalog(): { status: 'loading' | 'ready' | 'error'; catalog?: Catalog; error?: string }` (fetches `${import.meta.env.BASE_URL}catalog.json`); routes `/`, `/search`, `/plugin/:name`, `/plugin/:name/:kind/:item`, `/start`, `/news`, `*`; `catalogFixture: Catalog` with two plugins (one with a dependency, one with no README and no CHANGELOG, `stableVersion: null` on one).

- [ ] **Step 1: Write `App.test.tsx`** — with `fetch` mocked to the fixture, the home heading `Spec Driven Development` appears after loading; with `fetch` rejecting or returning invalid JSON, the text `The catalog could not be loaded` appears.
- [ ] **Step 2: Run** `npm test` (in `site/`) → FAIL.
- [ ] **Step 3: Implement** the scaffold, `useCatalog`, the router with placeholder screens, and `tokens.css` (the prototype's `:root` light/dark token blocks and base styles).
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add site .gitignore && git commit -m "feat(site): scaffold, routing, catalog loading"`

### Task A2: build-catalog.mjs

**Files:** Create `site/scripts/build-catalog.mjs`, `site/test/fixtures/repo/` (a marketplace with two plugins: agents with `tools` as a YAML list in one and an inline `[Read, Grep]` array in the other, one skill with `user-invocable: false`, a `hooks.json` with `SessionStart` and `PreToolUse`, a CHANGELOG with `[Unreleased]`, `[1.1.0] - 2026-10-20` and `[1.0.0] - 2026-10-18`, a stable file pinning `<name>--v1.0.0` for one plugin), `site/test/build-catalog.test.ts`.

**Interfaces:** Produces `buildCatalog({ root: string, stablePath?: string, sha?: string, now?: Date }): Catalog` (exported) and the CLI `--root <dir> --out <file> [--stable <path>]`. `sha` defaults to `GITHUB_SHA`, else `git rev-parse HEAD`, else `"local"`; `marketplace.repo` from `GITHUB_REPOSITORY`, else the first plugin's `repository` URL, else `null`.

- [ ] **Step 1: Write `build-catalog.test.ts`** against the fixture:
  - both plugins present with `version`, `displayName`, `keywords`, `dependencies[{name, range}]`;
  - `stableVersion` is `"1.0.0"` for the pinned plugin and `null` for the other;
  - `tools` normalizes to `["Read","Grep"]` from both YAML forms;
  - skill invocation `"/<plugin>:<skill>"`, `null` for the `user-invocable: false` one; agent invocation `"@agent-<plugin>:<agent>"`;
  - hooks: one component per distinct script basename in the `hooks.json` commands — the fixture registers `trace.mjs` on `SessionStart` and `bash-guard.mjs` on `PreToolUse`, giving components `trace` (`events: ["SessionStart"]`) and `bash-guard` (`events: ["PreToolUse"]`), each with `description` `Runs on <events joined by ", ">`;
  - `changelog` is `[1.1.0, 1.0.0]` with dates, no `Unreleased`;
  - a plugin with no README/CHANGELOG gets `readme: null`, `changelog: []` and one entry in `warnings`;
  - a CHANGELOG whose newest version differs from `plugin.json` makes `buildCatalog` throw `CHANGELOG newest version 1.1.0 ≠ plugin.json 1.0.0 in <name>`;
  - a marketplace entry whose source has no `plugin.json`, or whose `plugin.json` `name` differs, throws naming the entry.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with `yaml` for frontmatter and the hooks file read as JSON.
- [ ] **Step 4: Run** → PASS; then `npm run catalog` on the real repository → exits 0 (warnings allowed) and writes `public/catalog.json`.
- [ ] **Step 5: Commit** — `git commit -m "feat(site): build-catalog from the plugin files"` (after `git add site`).

### Task A3: Home screen, graph, header

**Files:** Create `src/screens/Home.tsx`, `src/components/{Header,Graph,KindBadge}.tsx`, `src/lib/graph.ts`, tests `src/lib/graph.test.ts`, `src/screens/Home.test.tsx`.

**Interfaces:** Produces `layoutGraph(plugins: Plugin[]): { nodes: { name: string; level: number; x: number; y: number }[]; edges: { from: string; to: string; range: string | null }[]; width: number; height: number }` — level = longest dependency path from a plugin nobody depends on; nodes evenly spaced per level; node box 196 × 40.

- [ ] **Step 1: Write the tests** — `layoutGraph` on the spec's graph (`sdd-engineering` → three, `architecture-review` → `engineering-paved-path`) puts `sdd-engineering` at level 0, `research-tools` and `architecture-review` at 1, `engineering-paved-path` at 2, with 4 edges. `Home` with the fixture shows counts per kind, the newest changelog entries under `What's new`, a node per plugin in the graph, and clicking a node navigates to `#/plugin/<name>`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the hero, search box (Enter → `/search?q=`), keyword chips, stats, graph, what's new (top 4), browse by type; the header with search, ⌘K button, theme button, `Connect`, `GitHub ↗` (from `marketplace.repo`). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(site): home, dependency graph, header"`.

### Task A4: Search screen, cards, copy

**Files:** Create `src/screens/Search.tsx`, `src/components/{Card,CopyButton}.tsx`, `src/lib/search.ts`, `src/lib/copy.ts`, tests `src/lib/search.test.ts`, `src/screens/Search.test.tsx`.

**Interfaces:** Produces `score(item: SearchItem, query: string): number` (every query term must match; a term in name or display name adds 5, elsewhere — description, keywords, excerpt, plugin name — adds 1; empty query scores 1) and `searchItems(catalog: Catalog): SearchItem[]` (one per plugin and per component). `copyText(text: string): Promise<boolean>`.

- [ ] **Step 1: Write the tests** — `score` values for a name hit, a description hit, a missing term (0); `Search` with the fixture filters by kind and keyword facets, sorts by name, shows `Nothing found` with `Reset filters`; `CopyButton` shows `✓ Copied` when `navigator.clipboard.writeText` resolves and the status `The browser blocked copying. Select the text by hand` when it rejects.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (query from `?q=`, facets in component state). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(site): search, cards, copy"`.

### Task A5: Plugin page

**Files:** Create `src/screens/PluginPage.tsx`, test `src/screens/PluginPage.test.tsx`.

- [ ] **Step 1: Write the test** — for the fixture plugin: display name, `latest <v>` and `stable <v>` (or `stable: not released`), install command `/plugin install <name>@<marketplace>`, components grouped by kind with their invocation, dependencies linking to their pages, "Depended on by", README rendered from Markdown, changelog entries with `stable`/`latest` marks; the plugin without README/CHANGELOG shows `No README` and `No releases yet`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (`react-markdown`, no raw HTML). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(site): plugin page"`.

### Task A6: Component page

**Files:** Create `src/screens/ComponentPage.tsx`, test `src/screens/ComponentPage.test.tsx`.

- [ ] **Step 1: Write the test** — breadcrumbs `Catalog / <plugin> / <name>`, kind badge, invocation chip when present, `Tools`, `Model`, `Preloaded skills`, `Event` sections only when non-empty, the excerpt under `Documentation`, up to four `More in this plugin` links.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(site): component page"`.

### Task A7: Getting started, what's new, palette, theme, footer, not found

**Files:** Create `src/screens/{Start,News,NotFound}.tsx`, `src/components/{Palette,Footer}.tsx`, tests `src/screens/Start.test.tsx`, `src/components/Palette.test.tsx`, `src/screens/NotFound.test.tsx`.

- [ ] **Step 1: Write the tests** — `Start` shows the four steps with `/plugin marketplace add <repo>`, `/plugin install sdd-engineering@<marketplace>`, the stable-channel settings snippet, `claude plugin list --json`, each with a copy button; ⌘K (and Ctrl+K) opens the palette, typing filters, Enter navigates, Escape closes; the theme button flips `data-theme` on `<html>` between `light` and `dark`; the footer shows `build <sha>` and the build time; `#/plugin/nope` and `#/plugin/<real>/agent/nope` render `Not found` with a link home.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(site): getting started, what's new, palette, theme, footer"`.

### Task A8: Pages workflow and the full build

**Files:** Create `.github/workflows/pages.yml`, `site/README.md`, test `site/test/pages-workflow.test.ts`.

**Interfaces:** Consumes the `site` scripts (A1).

- [ ] **Step 1: Write `pages-workflow.test.ts`** (parse with `yaml`) — triggers `push.branches: [main]` and `push.tags: ['*']`; permissions `pages: write`, `id-token: write`; a build job that checks out with `fetch-depth: 0`, sets up Node from `site/.nvmrc` (`actions/setup-node` with `node-version-file`), runs `npm ci` and `npm run build` in `site/`, uploads `site/dist` with `actions/upload-pages-artifact`; a deploy job with `actions/deploy-pages` and `environment: github-pages`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Write** the workflow and `site/README.md` (how the catalog is built, how to run it locally, what it reads). **Step 4: Run** `npm test` and `npm run build` in `site/` → both PASS; `dist/index.html` references assets under `/sdd-marketplace/`.
- [ ] **Step 5: Commit** — `git add .github site && git commit -m "ci(site): build and deploy the catalog to Pages"`.
- [ ] **Step 6: Stop and report** — test output, build output, a screenshot of the home and a plugin page from `vite preview` if a browser tool is available, and anything the real repository's files made the build warn about.
