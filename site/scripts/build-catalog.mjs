#!/usr/bin/env node
// Builds the catalog the site renders: reads the repository's marketplace file, the stable
// marketplace file, and each plugin's plugin.json, agents/, skills/, hooks/hooks.json, README.md
// and CHANGELOG.md, and writes one JSON file in the shape of site/src/types.ts (spec §3.8).
//
//   node scripts/build-catalog.mjs --root <repo> --out <file> [--stable <path relative to root>]
//
// Problems that make the catalog wrong throw (exit 1); missing optional files are warnings.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

export const DEFAULT_STABLE_PATH = '.claude-plugin/stable/marketplace.json';
const KIND_ORDER = { skill: 0, agent: 1, hook: 2 };

const posix = (p) => p.split(sep).join('/');
const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

function readJson(file, what) {
  const text = readText(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${what} is not valid JSON: ${e.message}`);
  }
}

/** A YAML list, an inline array or a comma-separated string, as a list of trimmed strings. */
export function normalizeList(value) {
  if (value === undefined || value === null || value === '') return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  return items.map((v) => String(v).trim()).filter(Boolean);
}

/** Splits a Markdown file into its YAML frontmatter and its body. */
function frontmatter(text, file, warnings) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { data: {}, body: text };
  const body = text.slice(m[0].length);
  try {
    const data = parseYaml(m[1]);
    return { data: data && typeof data === 'object' ? data : {}, body };
  } catch (e) {
    warnings.push(`${file}: frontmatter is not valid YAML (${String(e.message).split('\n')[0]}); read line by line`);
    const data = {};
    for (const line of m[1].split(/\r?\n/)) {
      const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
      if (kv) data[kv[1]] = kv[2].replace(/^(['"])(.*)\1$/, '$2');
    }
    return { data, body };
  }
}

/** The first two non-heading paragraphs of a Markdown body, separated by a blank line. */
export function excerpt(markdown) {
  const paragraphs = [];
  let current = [];
  let fence = null;
  const flush = () => {
    if (current.length) paragraphs.push(current.join('\n'));
    current = [];
  };
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (fence) {
      if (line.trimStart().startsWith(fence)) fence = null;
      continue;
    }
    const open = /^\s*(```|~~~)/.exec(line);
    if (open) { flush(); fence = open[1]; continue; }
    if (/^\s*$/.test(line)) { flush(); continue; }
    if (/^#{1,6}\s/.test(line) || /^\s*<!--.*-->\s*$/.test(line) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); continue; }
    current.push(line);
  }
  flush();
  return paragraphs.slice(0, 2).join('\n\n');
}

/** Keep a Changelog sections, newest first, without Unreleased. */
export function parseChangelog(markdown) {
  const entries = [];
  let entry = null;
  let lines = [];
  const close = () => {
    if (entry) entries.push({ ...entry, summary: summarize(lines) });
    entry = null;
    lines = [];
  };
  for (const line of markdown.split(/\r?\n/)) {
    const h = /^##\s+\[?([^\]\s]+)\]?(?:\s*[-–—]\s*(\d{4}-\d{2}-\d{2}))?/.exec(line);
    if (h && !line.startsWith('###')) {
      close();
      if (h[1].toLowerCase() !== 'unreleased') entry = { version: h[1].replace(/^v/, ''), date: h[2] ?? null };
      continue;
    }
    if (entry) lines.push(line);
  }
  close();
  return entries;
}

function summarize(lines) {
  return lines
    .filter((l) => l.trim() && !/^\s*#/.test(l) && !/^\s*\[[^\]]+\]:\s/.test(l))
    .map((l) => l.trim().replace(/^[-*+]\s+/, ''))
    .map((l) => (/[.!?:;]$/.test(l) ? l : `${l}.`))
    .join(' ');
}

function listDir(dir) {
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

function scanAgents(pluginDir, pluginName, root, warnings) {
  return listDir(join(pluginDir, 'agents'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const file = join(pluginDir, 'agents', f);
      const rel = posix(relative(root, file));
      const { data, body } = frontmatter(readFileSync(file, 'utf8'), rel, warnings);
      const name = String(data.name ?? basename(f, '.md'));
      return {
        kind: 'agent', name, description: String(data.description ?? ''),
        invocation: `@agent-${pluginName}:${name}`,
        tools: normalizeList(data.tools), model: data.model ? String(data.model) : null,
        skills: normalizeList(data.skills), events: [], excerpt: excerpt(body), path: rel,
      };
    });
}

function scanSkills(pluginDir, pluginName, root, warnings) {
  return listDir(join(pluginDir, 'skills'))
    .filter((d) => existsSync(join(pluginDir, 'skills', d, 'SKILL.md')))
    .map((d) => {
      const file = join(pluginDir, 'skills', d, 'SKILL.md');
      const rel = posix(relative(root, file));
      const { data, body } = frontmatter(readFileSync(file, 'utf8'), rel, warnings);
      const name = String(data.name ?? d);
      const invocable = data['user-invocable'] !== false && data['user-invocable'] !== 'false';
      return {
        kind: 'skill', name, description: String(data.description ?? ''),
        invocation: invocable ? `/${pluginName}:${name}` : null,
        tools: normalizeList(data.tools ?? data['allowed-tools']), model: data.model ? String(data.model) : null,
        skills: [], events: [], excerpt: excerpt(body), path: rel,
      };
    });
}

/** One component per distinct script a hooks.json command runs, with the events it is registered on. */
function scanHooks(pluginDir, root) {
  const file = join(pluginDir, 'hooks', 'hooks.json');
  const rel = posix(relative(root, file));
  const data = readJson(file, rel);
  if (!data) return [];
  const byName = new Map();
  for (const [event, groups] of Object.entries(data.hooks ?? {})) {
    for (const group of Array.isArray(groups) ? groups : []) {
      for (const hook of Array.isArray(group?.hooks) ? group.hooks : []) {
        const command = typeof hook?.command === 'string' ? hook.command : '';
        const scripts = [...command.matchAll(/([^\s"'/\\]+)\.(?:mjs|cjs|js|ts|sh|bash|py)\b/g)];
        const script = scripts.at(-1);
        const name = script ? script[1] : (command.trim().split(/\s+/)[0] ? basename(command.trim().split(/\s+/)[0]) : String(hook?.type ?? 'hook'));
        const pathMatch = /\$\{?CLAUDE_PLUGIN_ROOT\}?\/([^\s"']+)/.exec(command);
        const path = pathMatch ? posix(relative(root, join(pluginDir, pathMatch[1]))) : rel;
        const entry = byName.get(name) ?? { name, events: [], path };
        if (!entry.events.includes(event)) entry.events.push(event);
        byName.set(name, entry);
      }
    }
  }
  return [...byName.values()].map((h) => ({
    kind: 'hook', name: h.name, description: `Runs on ${h.events.join(', ')}`, invocation: null,
    tools: [], model: null, skills: [], events: h.events, excerpt: '', path: h.path,
  }));
}

function githubRepo(repository) {
  const url = typeof repository === 'string' ? repository : repository?.url;
  const m = /github\.com[/:]([^/\s]+)\/([^/#?\s]+?)(?:\.git)?(?:[/#?].*)?$/.exec(url ?? '');
  return m ? `${m[1]}/${m[2]}` : null;
}

function gitSha(root) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

function stableVersions(root, stablePath, names, warnings) {
  const file = resolve(root, stablePath);
  const data = readJson(file, stablePath);
  const versions = new Map();
  if (!data) {
    warnings.push(`no stable marketplace file at ${stablePath}: every plugin shows stable: not released`);
    return versions;
  }
  for (const entry of Array.isArray(data.plugins) ? data.plugins : []) {
    const name = entry?.name;
    const ref = entry?.source?.ref ?? entry?.ref;
    if (!names.includes(name)) {
      warnings.push(`stable file entry ${name} is not in the marketplace`);
      continue;
    }
    const m = typeof ref === 'string' ? new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}--v(.+)$`).exec(ref) : null;
    if (!m) {
      warnings.push(`stable file entry ${name}: ref ${ref ?? '(none)'} is not ${name}--v<version>`);
      continue;
    }
    versions.set(name, m[1]);
  }
  return versions;
}

export function buildCatalog({ root, stablePath = DEFAULT_STABLE_PATH, sha, now } = {}) {
  root = resolve(root);
  const warnings = [];
  const marketFile = '.claude-plugin/marketplace.json';
  const market = readJson(join(root, marketFile), marketFile);
  if (!market) throw new Error(`no ${marketFile} under ${root}`);
  const entries = Array.isArray(market.plugins) ? market.plugins : [];
  const pluginRoot = resolve(root, market.metadata?.pluginRoot ?? '.');

  const plugins = entries.map((entry) => {
    const entryName = entry?.name;
    if (typeof entry?.source !== 'string') {
      throw new Error(`Marketplace entry ${entryName}: source is not a relative path in this repository`);
    }
    const dir = resolve(pluginRoot, entry.source);
    const path = posix(relative(root, dir));
    const manifestRel = `${path}/.claude-plugin/plugin.json`;
    const manifest = readJson(join(dir, '.claude-plugin', 'plugin.json'), manifestRel);
    if (!manifest) throw new Error(`Marketplace entry ${entryName}: no plugin.json at ${manifestRel}`);
    if (manifest.name !== entryName) {
      throw new Error(`Marketplace entry ${entryName}: plugin.json name is "${manifest.name}"`);
    }
    if (!manifest.version) throw new Error(`Marketplace entry ${entryName}: plugin.json has no version`);
    const name = manifest.name;
    const version = String(manifest.version);
    const missing = [];

    const readme = readText(join(dir, 'README.md'));
    if (readme === null) missing.push('no README.md');
    const changelogText = readText(join(dir, 'CHANGELOG.md'));
    if (changelogText === null) missing.push('no CHANGELOG.md');
    const changelog = changelogText === null ? [] : parseChangelog(changelogText);
    if (changelog.length && changelog[0].version !== version) {
      throw new Error(`CHANGELOG newest version ${changelog[0].version} ≠ plugin.json ${version} in ${name}`);
    }
    if (!manifest.displayName) missing.push('no displayName in plugin.json');

    const components = [
      ...scanSkills(dir, name, root, warnings),
      ...scanAgents(dir, name, root, warnings),
      ...scanHooks(dir, root),
    ].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));
    if (!components.length) missing.push('no skills, agents or hooks');
    if (missing.length) warnings.push(`${name}: ${missing.join('; ')}`);

    const author = typeof manifest.author === 'string' ? manifest.author : manifest.author?.name ?? '';
    const dependencies = (Array.isArray(manifest.dependencies) ? manifest.dependencies : []).map((d) =>
      typeof d === 'string' ? { name: d, range: null } : { name: String(d?.name), range: d?.version ? String(d.version) : null },
    );
    return {
      name, displayName: String(manifest.displayName || name), description: String(manifest.description ?? entry.description ?? ''),
      author, keywords: normalizeList(manifest.keywords), version, stableVersion: null, dependencies,
      readme, changelog, components, path, repository: manifest.repository,
    };
  });

  const names = plugins.map((p) => p.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) throw new Error(`Marketplace lists ${dupes[0]} more than once`);
  for (const p of plugins) {
    for (const d of p.dependencies) {
      if (!names.includes(d.name)) warnings.push(`${p.name}: dependency ${d.name} is not in this marketplace`);
    }
  }
  const stable = stableVersions(root, stablePath, names, warnings);

  const repo = process.env.GITHUB_REPOSITORY || plugins.map((p) => githubRepo(p.repository)).find(Boolean) || null;
  const owner = typeof market.owner === 'string' ? market.owner : market.owner?.name ?? '';
  return {
    marketplace: {
      name: String(market.name ?? ''), owner, description: String(market.description ?? market.metadata?.description ?? ''), repo,
    },
    build: { sha: sha || process.env.GITHUB_SHA || gitSha(root) || 'local', builtAt: (now ?? new Date()).toISOString() },
    plugins: plugins.map(({ repository: _repository, ...p }) => ({ ...p, stableVersion: stable.get(p.name) ?? null })),
    warnings,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!['--root', '--out', '--stable'].includes(key) || value === undefined) {
      throw new Error(`usage: build-catalog.mjs --root <dir> --out <file> [--stable <path>] (bad argument ${key})`);
    }
    args[key.slice(2)] = value;
  }
  if (!args.root || !args.out) throw new Error('usage: build-catalog.mjs --root <dir> --out <file> [--stable <path>]');
  return args;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const catalog = buildCatalog({ root: args.root, stablePath: args.stable });
    const out = resolve(args.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(catalog, null, 2)}\n`);
    for (const w of catalog.warnings) process.stderr.write(`warning: ${w}\n`);
    const count = catalog.plugins.reduce((n, p) => n + p.components.length, 0);
    process.stdout.write(`catalog: ${catalog.plugins.length} plugins, ${count} components, ${catalog.warnings.length} warnings → ${args.out}\n`);
  } catch (e) {
    process.stderr.write(`build-catalog: ${e.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && statSync(process.argv[1]).isFile()
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
