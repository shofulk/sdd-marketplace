// Repository-wide rules for the sdd marketplace (plan B1, spec §3.2–§3.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGINS_DIR = join(ROOT, 'plugins');
const EXPECTED = ['engineering-paved-path', 'research-tools', 'architecture-review', 'sdd-engineering'];

// Strings that name DevDigest, its packages, commands or project files (Global Constraints).
const FORBIDDEN = [
  'DevDigest', 'dev-digest', 'server/', 'client/', 'reviewer-core', 'e2e/', 'mcp-server',
  'pnpm --dir', 'INSIGHTS.md', 'AGENTS.md', 'TESTING.md', '.claude/scripts', '.claude/hooks', '.harness/',
];
const FORBIDDEN_AGENT_KEYS = ['hooks', 'permissionMode', 'mcpServers', 'initialPrompt'];

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const marketplace = () => readJson(join(ROOT, '.claude-plugin', 'marketplace.json'));
const pluginDirs = () =>
  readdirSync(PLUGINS_DIR).filter((n) => statSync(join(PLUGINS_DIR, n)).isDirectory()).sort();

// Top-level keys of a Markdown file's YAML frontmatter (the subset agents and skills use).
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return null;
  const out = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const km = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (!km) continue;
    const body = [];
    while (i + 1 < lines.length && (/^\s/.test(lines[i + 1]) || lines[i + 1] === '')) body.push(lines[++i]);
    out[km[1]] = yamlValue(km[2].trim(), body);
  }
  return out;
}

function scalar(s) {
  const t = s.trim();
  if (/^".*"$/.test(t) || /^'.*'$/.test(t)) return t.slice(1, -1);
  if (t === 'true') return true;
  if (t === 'false') return false;
  return t;
}

function yamlValue(v, body) {
  if (v.startsWith('[')) return v.replace(/^\[|\]$/g, '').split(',').map(scalar).filter((x) => x !== '');
  if (/^[>|][+-]?$/.test(v)) return body.map((l) => l.trim()).filter(Boolean).join(v[0] === '>' ? ' ' : '\n');
  if (v === '' && body.some((l) => /^\s*-\s/.test(l))) {
    return body.filter((l) => /^\s*-\s/.test(l)).map((l) => scalar(l.replace(/^\s*-\s/, '')));
  }
  if (v === '') return body.join('\n');
  return scalar(v);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test('every marketplace entry has a plugin.json with the same name', () => {
  for (const entry of marketplace().plugins) {
    const manifest = join(ROOT, entry.source, '.claude-plugin', 'plugin.json');
    assert.ok(existsSync(manifest), `${entry.name}: missing ${relative(ROOT, manifest)}`);
    assert.equal(readJson(manifest).name, entry.name, `${entry.name}: plugin.json name differs`);
  }
});

test('marketplace lists exactly the four plugins', () => {
  const names = marketplace().plugins.map((p) => p.name).sort();
  assert.deepEqual(names, [...EXPECTED].sort());
});

test('no tracked file carries a home directory path', () => {
  const files = spawnSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8' }).stdout.split('\0').filter(Boolean);
  assert.ok(files.length > 0, 'git ls-files listed nothing');
  const hits = [];
  for (const f of files) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    if (/\/Users\/[^/\s"']+\/|\/home\/[^/\s"']+\//.test(text)) hits.push(f);
  }
  assert.deepEqual(hits, []);
});

test('no forbidden strings under plugins/', () => {
  const hits = [];
  for (const file of walk(PLUGINS_DIR)) {
    if (file.split('/').pop() === 'NOTICE') continue;
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const s of FORBIDDEN) if (line.includes(s)) hits.push(`${relative(ROOT, file)}:${i + 1}: ${s}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('plugin agents use only supported frontmatter', () => {
  for (const plugin of pluginDirs()) {
    const agents = join(PLUGINS_DIR, plugin, 'agents');
    if (!existsSync(agents)) continue;
    for (const f of readdirSync(agents).filter((n) => n.endsWith('.md'))) {
      const fm = frontmatter(readFileSync(join(agents, f), 'utf8'));
      const where = `${plugin}/agents/${f}`;
      assert.ok(fm, `${where}: no frontmatter`);
      assert.ok(fm.name, `${where}: no name`);
      assert.ok(fm.description, `${where}: no description`);
      for (const k of FORBIDDEN_AGENT_KEYS) assert.ok(!(k in fm), `${where}: ${k} is ignored in a plugin agent`);
    }
  }
});

test('every plugin has README.md, CHANGELOG.md and NOTICE', () => {
  for (const plugin of pluginDirs()) {
    for (const f of ['README.md', 'CHANGELOG.md', 'NOTICE']) {
      assert.ok(existsSync(join(PLUGINS_DIR, plugin, f)), `${plugin}: missing ${f}`);
    }
  }
});

test('hooks/lib copies match tools/hooklib', () => {
  const canonical = join(ROOT, 'tools', 'hooklib');
  const names = readdirSync(canonical).filter((n) => n.endsWith('.mjs')).sort();
  for (const plugin of pluginDirs()) {
    const lib = join(PLUGINS_DIR, plugin, 'hooks', 'lib');
    const hooksJson = join(PLUGINS_DIR, plugin, 'hooks', 'hooks.json');
    const wired = existsSync(hooksJson) && readFileSync(hooksJson, 'utf8').includes('/hooks/lib/');
    if (!existsSync(lib)) {
      assert.ok(!wired, `${plugin}: hooks.json uses hooks/lib/ but the copy is missing — run npm run sync-hooklib`);
      continue;
    }
    assert.deepEqual(readdirSync(lib).sort(), names, `${plugin}/hooks/lib: file set differs — run npm run sync-hooklib`);
    for (const n of names) {
      assert.equal(readFileSync(join(lib, n), 'utf8'), readFileSync(join(canonical, n), 'utf8'),
        `${plugin}/hooks/lib/${n} differs from tools/hooklib — run npm run sync-hooklib`);
    }
  }
});

test('CHANGELOG newest version equals plugin.json version', (t) => {
  let checked = 0;
  for (const plugin of pluginDirs()) {
    const log = readFileSync(join(PLUGINS_DIR, plugin, 'CHANGELOG.md'), 'utf8');
    const newest = /^## \[([^\]]+)\]/m.exec(log);
    assert.ok(newest, `${plugin}: CHANGELOG has no "## [...]" heading`);
    if (newest[1] === 'Unreleased') continue;
    const version = readJson(join(PLUGINS_DIR, plugin, '.claude-plugin', 'plugin.json')).version;
    assert.equal(newest[1], version, `${plugin}: CHANGELOG ${newest[1]} vs plugin.json ${version}`);
    checked++;
  }
  if (!checked) t.skip('every newest heading is [Unreleased]');
});
