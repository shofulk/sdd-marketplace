// sdd-engineering/skills/run-plan — the orchestration skill (plan B7, spec §3.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'run-plan');
const skill = readFileSync(join(DIR, 'SKILL.md'), 'utf8');
const all = ['SKILL.md', 'prompts.md', 'triage.md'].map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');

test('frontmatter: run-plan, user-invoked only', () => {
  const fm = /^---\n([\s\S]*?)\n---/.exec(skill)[1];
  assert.match(fm, /^name: run-plan$/m);
  assert.match(fm, /^disable-model-invocation: true$/m);
  assert.match(fm, /^description: \S/m);
  assert.match(fm, /^argument-hint: /m);
});

test('dispatches the plugin agents by namespaced name', () => {
  for (const a of ['sdd-engineering:implementer', 'sdd-engineering:plan-verifier', 'architecture-review:architecture-reviewer', 'research-tools:researcher']) {
    assert.ok(skill.includes(a), a);
  }
});

test('every script reference goes through ${CLAUDE_PLUGIN_ROOT}/scripts/', () => {
  const refs = all.match(/[^\s`'"(]*scripts\/[a-z-]+\.(?:mjs|sh)/g) ?? [];
  assert.ok(refs.length >= 3, 'expected script references');
  for (const r of refs) assert.ok(r.startsWith('${CLAUDE_PLUGIN_ROOT}/scripts/'), r);
  for (const s of ['checks.mjs', 'lane-brief.mjs']) assert.ok(skill.includes('${CLAUDE_PLUGIN_ROOT}/scripts/' + s), s);
});

test('documents the optional project agents and their fallbacks', () => {
  for (const a of ['test-writer', 'security-reviewer', 'retro-writer', 'doc-writer']) assert.ok(skill.includes(a), a);
  assert.match(skill, /`agents`/);
  assert.match(skill, /no `test-writer`[^\n]*implementer[^\n]*red/i);
  assert.match(skill, /no `security-reviewer`[^\n]*architecture[^\n]*plan/i);
  assert.match(skill, /no `retro-writer`[^\n]*budget/i);
  assert.match(skill, /pr-self-review/);
});

test('specifies the run state lines', () => {
  for (const line of [
    'Plan: <path>',
    'Revision: <n>',
    'Phase: <lanes|gate|review|fix|finish>',
    'Status: running|done|blocked',
    'Plan verification: <met>/<total>',
    'Plugins: <name>@<version>, …',
  ]) assert.ok(skill.includes(line), line);
  assert.match(skill, /\.sdd\/trace\.jsonl/);
  assert.match(skill, /`runs`/);
});

test('keeps resume, from and the round budget', () => {
  assert.match(skill, /--resume/);
  assert.match(skill, /--from/);
  assert.match(skill, /--rounds N/);
  assert.match(skill, /Default \*\*3\*\*/);
});
