// sdd-engineering: the four agents, the two spec skills and hooks.json (plan B6).
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
    else if (v === '' && body.length && body.every((l) => l.startsWith('- '))) v = body.map((l) => l.slice(2).trim());
    else if (/^[>|][+-]?$/.test(v)) v = body.join(' ');
    else if (v === 'true' || v === 'false') v = v === 'true';
    out[km[1]] = v;
  }
  return out;
}

const read = (rel) => readFileSync(join(PLUGIN, rel), 'utf8');
const ARCH = ['engineering-paved-path:onion-architecture', 'engineering-paved-path:frontend-ui-architecture'];
const AGENTS = {
  'spec-creator': { model: 'opus', tools: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'], skills: ['spec-writing', 'mermaid-diagram'] },
  'implementation-planner': { model: 'opus', tools: ['Read', 'Grep', 'Glob', 'Bash'], skills: ARCH },
  implementer: { model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill'], skills: ARCH },
  'plan-verifier': { model: 'opus', tools: ['Read', 'Grep', 'Glob', 'Bash'], skills: undefined },
};

for (const [name, want] of Object.entries(AGENTS)) {
  test(`${name}: model, tools and preloaded skills`, () => {
    const fm = frontmatter(read(`agents/${name}.md`));
    assert.equal(fm.name, name);
    assert.equal(fm.model, want.model);
    assert.deepEqual(fm.tools, want.tools);
    assert.deepEqual(fm.skills, want.skills);
    assert.ok(Array.isArray(fm.disallowedTools) && fm.disallowedTools.includes('Agent'), 'Agent is disallowed');
  });

  test(`${name}: names no project-specific review skill path`, () => {
    assert.ok(!read(`agents/${name}.md`).includes('.claude/skills/pr-self-review'));
  });
}

test('the read-only agents cannot write', () => {
  for (const name of ['implementation-planner', 'plan-verifier']) {
    const fm = frontmatter(read(`agents/${name}.md`));
    for (const t of ['Write', 'Edit', 'Skill']) assert.ok(fm.disallowedTools.includes(t), `${name}: ${t}`);
  }
});

test('the agents read the project contract', () => {
  for (const name of Object.keys(AGENTS)) assert.match(read(`agents/${name}.md`), /\.sdd\/config\.json/, name);
});

test('spec-creator asks for researcher runs through the main session', () => {
  assert.match(read('agents/spec-creator.md'), /research-tools:researcher/);
});

test('the implementer loads the project skills its brief names through Skill', () => {
  assert.match(read('agents/implementer.md'), /`skills`/);
});

test('spec-writing and mermaid-diagram are preload-only', () => {
  for (const s of ['spec-writing', 'mermaid-diagram']) {
    const fm = frontmatter(read(`skills/${s}/SKILL.md`));
    assert.equal(fm.name, s);
    assert.equal(fm['user-invocable'], false, s);
  }
});

test('spec-writing ships the spec template', () => {
  const t = read('skills/spec-writing/template.md');
  for (const s of ['# Spec: <feature name>', 'Spec ID: SPEC-NN-<feature>', '## Acceptance criteria (EARS)', '## Traceability']) {
    assert.ok(t.includes(s), s);
  }
});

const hooks = JSON.parse(read('hooks/hooks.json')).hooks;
const commands = (event, matcher) =>
  (hooks[event] ?? []).filter((g) => matcher === undefined || g.matcher === matcher).flatMap((g) => g.hooks.map((h) => h.command));

test('hooks.json: Bash guards per agent', () => {
  const bash = commands('PreToolUse', 'Bash');
  const has = (s) => assert.ok(bash.some((c) => c.includes(s)), `missing: ${s}`);
  has('bash-guard.mjs" readonly --agents sdd-engineering:spec-creator,sdd-engineering:implementation-planner');
  has('bash-guard.mjs" checks --agents sdd-engineering:plan-verifier');
  has('bash-guard.mjs" implementer --agents sdd-engineering:implementer');
  for (const c of bash.filter((c) => c.includes('bash-guard.mjs'))) assert.ok(c.startsWith('node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/bash-guard.mjs"'), c);
});

test('hooks.json: spec-guard and spec-lint on Write|Edit', () => {
  const pre = commands('PreToolUse', 'Write|Edit');
  assert.ok(pre.includes('node "${CLAUDE_PLUGIN_ROOT}/hooks/spec-guard.mjs" --agents sdd-engineering:spec-creator'), JSON.stringify(pre));
  assert.ok(pre.includes('node "${CLAUDE_PLUGIN_ROOT}/hooks/spec-lint.mjs" pre'), JSON.stringify(pre));
  assert.deepEqual(commands('PostToolUse', 'Write|Edit'), ['node "${CLAUDE_PLUGIN_ROOT}/hooks/spec-lint.mjs" post']);
});

test('hooks.json: SessionStart trace', () => {
  assert.deepEqual(commands('SessionStart'), ['node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/trace.mjs"']);
});
