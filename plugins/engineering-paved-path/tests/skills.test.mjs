// engineering-paved-path: the seven stack skills and the trace hook (plan B3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(PLUGIN, 'skills');
const EXPECTED = [
  'fastify-best-practices', 'frontend-ui-architecture', 'nextjs-app-router', 'onion-architecture',
  'react-best-practices', 'react-testing-library', 'security',
];

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const km = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (!km) continue;
    let v = km[2].trim();
    const body = [];
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) body.push(lines[++i].trim());
    if (/^[>|][+-]?$/.test(v)) v = body.join(' ');
    out[km[1]] = v.replace(/^"(.*)"$/, '$1');
  }
  return out;
}

const skillDirs = () => readdirSync(SKILLS).filter((n) => statSync(join(SKILLS, n)).isDirectory()).sort();

test('skills/ holds exactly the seven skills', () => {
  assert.deepEqual(skillDirs(), EXPECTED);
});

test('each SKILL.md names its directory and has a description', () => {
  for (const dir of skillDirs()) {
    const fm = frontmatter(readFileSync(join(SKILLS, dir, 'SKILL.md'), 'utf8'));
    assert.ok(fm, `${dir}: no frontmatter`);
    assert.equal(fm.name, dir, `${dir}: frontmatter name`);
    assert.ok(fm.description && fm.description.length > 20, `${dir}: description`);
  }
});

test('nextjs-app-router links the Next.js docs for its rules', () => {
  const text = readFileSync(join(SKILLS, 'nextjs-app-router', 'SKILL.md'), 'utf8');
  const links = text.match(/https:\/\/nextjs\.org\/docs[^\s)>\]]*/g) ?? [];
  assert.ok(links.length >= 5, `only ${links.length} nextjs.org/docs links`);
  const lines = text.split('\n').length;
  assert.ok(lines >= 150 && lines <= 250, `${lines} lines, expected 150–250`);
});

test('onion-architecture carries no project ring map', () => {
  const text = readFileSync(join(SKILLS, 'onion-architecture', 'SKILL.md'), 'utf8');
  for (const s of ['vendor/shared', '@' + 'devdigest', 'platform/container']) assert.ok(!text.includes(s), s);
});

test('hooks.json runs the SessionStart trace from hooks/lib', () => {
  const hooks = JSON.parse(readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
  assert.deepEqual(Object.keys(hooks), ['SessionStart']);
  const commands = hooks.SessionStart.flatMap((g) => g.hooks.map((h) => h.command));
  assert.deepEqual(commands, ['node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/trace.mjs"']);
});
