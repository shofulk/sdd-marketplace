# The marketplace catalog

A React + Vite single-page site that shows the marketplace's current composition and versions: home
(search, keywords, counts, the dependency graph, what's new), search with filters, a page per plugin and
per component, getting started, and what's new, plus a ⌘K palette, a light/dark theme and copy buttons.
Nothing in the app is written by hand: every plugin, version and component comes from `catalog.json`.

## How the catalog is built

`scripts/build-catalog.mjs` reads the repository and writes `public/catalog.json` (git-ignored) in the
shape of `src/types.ts`:

| Source | What it gives |
|---|---|
| `.claude-plugin/marketplace.json` | the marketplace name, owner, description and its plugins (relative `source` paths) |
| `.claude-plugin/stable/marketplace.json` | each plugin's stable version, from the entry's `source.ref` = `<plugin>--v<version>`; no file means "stable: not released" |
| `plugins/<p>/.claude-plugin/plugin.json` | name, displayName, version (= latest), description, author, keywords, dependencies, repository |
| `plugins/<p>/agents/*.md` | agents: frontmatter `name`, `description`, `tools`, `model`, `skills`; the first two paragraphs of the body |
| `plugins/<p>/skills/<s>/SKILL.md` | skills: frontmatter `name`, `description`, `user-invocable`; the first two paragraphs |
| `plugins/<p>/hooks/hooks.json` | hooks: one per script the commands run, with its events |
| `plugins/<p>/README.md`, `CHANGELOG.md` | the README (Markdown) and the releases (Keep a Changelog, without Unreleased) |

The build stops with an error when a marketplace entry has no `plugin.json`, when its `plugin.json` names
another plugin, or when a CHANGELOG's newest version differs from `plugin.json`. Missing READMEs,
CHANGELOGs, display names, components or the stable file are warnings. The commit SHA comes from
`GITHUB_SHA`, else `git rev-parse HEAD`; the GitHub repository from `GITHUB_REPOSITORY`, else the first
plugin's `repository` URL.

## Run it locally

Node 22.22.2 or newer (`.nvmrc`; vitest and jsdom need it).

```bash
cd site
npm ci
npm run dev       # build-catalog, then the Vite dev server
npm test          # unit and screen tests (Vitest, jsdom, React Testing Library)
npm run build     # build-catalog → tsc → vite build into dist/
npm run preview   # serve dist/ at /sdd-marketplace/
npm run catalog   # only write public/catalog.json
```

`node scripts/build-catalog.mjs --root .. --out public/catalog.json --stable <path>` takes another stable
file, relative to the root.

## Deploy

`.github/workflows/pages.yml` runs on every push to `main` and every tag push: `npm ci`, `npm run build`
(which runs build-catalog first), `npm test`, then uploads `site/dist` and deploys it with the Pages
action. The site lives at `https://<owner>.github.io/sdd-marketplace/`: Vite's `base` is
`/sdd-marketplace/`, and routing uses a hash router because Pages has no single-page fallback.

Turning Pages on is a repository setting (Settings → Pages → Source: GitHub Actions). For tag pushes to
deploy, the `github-pages` environment must allow tags as well as `main` (Settings → Environments →
github-pages → Deployment branches and tags).
