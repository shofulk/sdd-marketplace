// research-tools: the researcher agent and the trace hook (plan B4).
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

const agentText = readFileSync(join(PLUGIN, 'agents', 'researcher.md'), 'utf8');
const fm = frontmatter(agentText);

test('researcher frontmatter: name, model, tools, disallowedTools', () => {
  assert.equal(fm.name, 'researcher');
  assert.equal(fm.model, 'sonnet');
  assert.deepEqual(fm.tools, ['Read', 'Grep', 'Glob', 'Bash', 'WebSearch', 'WebFetch', 'AskUserQuestion']);
  assert.ok(fm.disallowedTools.includes('Write'));
  assert.ok(fm.disallowedTools.includes('Edit'));
});

test('researcher keeps the clarify gate, the two report types and the not-found list', () => {
  for (const s of ['Clarify gate', 'Repo Research Report', 'External Research Report', 'Not found', 'Answer status']) {
    assert.ok(agentText.includes(s), s);
  }
});

test('researcher reads the project contract for its context files', () => {
  assert.match(agentText, /\.sdd\/config\.json/);
  assert.match(agentText, /`context`/);
});

test('hooks.json holds only the SessionStart trace', () => {
  const hooks = JSON.parse(readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
  assert.deepEqual(Object.keys(hooks), ['SessionStart']);
  assert.deepEqual(hooks.SessionStart.flatMap((g) => g.hooks.map((h) => h.command)),
    ['node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/trace.mjs"']);
});
