// architecture-review: the architecture-reviewer agent and its hooks (plan B5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..');

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const km = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (!km) continue;
    let v = km[2].trim();
    const body = [];
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) body.push(lines[++i].trim());
    if (v.startsWith('[')) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    else if (v === '' && body.every((l) => l.startsWith('- '))) v = body.map((l) => l.slice(2).trim());
    else if (/^[>|][+-]?$/.test(v)) v = body.join(' ');
    out[km[1]] = v;
  }
  return out;
}

const text = readFileSync(join(PLUGIN, 'agents', 'architecture-reviewer.md'), 'utf8');
const fm = frontmatter(text);
const body = text.slice(text.indexOf('\n---', 4) + 4);
const hooks = JSON.parse(readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
const commands = (event, matcher) =>
  (hooks[event] ?? []).filter((g) => matcher === undefined || g.matcher === matcher).flatMap((g) => g.hooks.map((h) => h.command));

test('frontmatter: preloads the two paved-path architecture skills by namespaced name', () => {
  assert.equal(fm.name, 'architecture-reviewer');
  assert.deepEqual(fm.skills, ['engineering-paved-path:onion-architecture', 'engineering-paved-path:frontend-ui-architecture']);
  assert.equal(fm.model, 'opus');
  assert.deepEqual(fm.tools, ['Read', 'Grep', 'Glob', 'Bash']);
  for (const t of ['Write', 'Edit', 'Skill']) assert.ok(fm.disallowedTools.includes(t), t);
});

test('hooks.json: the checks Bash guard for this agent, and the SessionStart trace', () => {
  const bash = commands('PreToolUse', 'Bash');
  assert.equal(bash.length, 1);
  assert.ok(bash[0].includes('bash-guard.mjs" checks --agents architecture-review:architecture-reviewer'), bash[0]);
  assert.ok(bash[0].startsWith('node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/'), bash[0]);
  assert.deepEqual(commands('SessionStart'), ['node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/trace.mjs"']);
});

test('body: runs the configured arch checks first and maps severities', () => {
  assert.match(body, /\.sdd\/config\.json/);
  assert.match(body, /`checks\.<pkg>\.arch`/);
  assert.match(body, /`error`[^\n]*→ \*\*critical\*\*/);
  assert.match(body, /`warn`[^\n]*→ \*\*major\*\*/);
});

test('body: keeps the finding shape and the no-fix rule', () => {
  for (const s of ['`file:line`', 'Edge from → to', 'Severity', 'Evidence', 'No fixes', 'Review status']) assert.ok(body.includes(s), s);
});
