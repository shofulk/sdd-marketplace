// sdd-engineering/hooks/spec-lint.mjs — the spec format check (plan B6). The cases are the
// source project's spec-lint self-test, ported to node:test, plus the config-driven locations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lint } from '../hooks/spec-lint.mjs';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(PLUGIN, 'hooks', 'spec-lint.mjs');
const example = readFileSync(join(PLUGIN, 'skills', 'spec-writing', 'references', 'intent-card.spec.md'), 'utf8');
const R = 'specs/intent-card.spec.md';
const sub = (a, b) => {
  if (!example.includes(a)) throw new Error('fixture drift: ' + a);
  return example.replace(a, b);
};

function root(other, config) {
  const dir = mkdtempSync(join(tmpdir(), 'sdd-spec-lint-'));
  for (const d of ['specs', 'web/.spec', '.sdd']) mkdirSync(join(dir, d), { recursive: true });
  if (other) writeFileSync(join(dir, other.rel), other.content);
  if (config) writeFileSync(join(dir, '.sdd', 'config.json'), config);
  return dir;
}

const cases = [
  ['reference example is clean', R, example, true],
  ['approved example is clean', R, sub('Status: draft', 'Status: approved'), true],
  ['bad title', R, sub('# Spec: PR intent card', '# PR intent card'), false],
  ['slug differs from file name', 'specs/other.spec.md', example, false],
  ['Spec ID without slug', R, sub('SPEC-00-intent-card', 'SPEC-00'), false],
  ['bad status', R, sub('Status: draft', 'Status: wip'), false],
  ['bad Supersedes', R, sub('Supersedes: none', 'Supersedes: old one'), false],
  ['missing section', R, sub('## Assumptions\n', ''), false],
  ['Module interactions missing in the cross-module folder', R, sub('## Module interactions', '## Interactions'), false],
  ['Module interactions not allowed in <pkg>/.spec', 'web/.spec/intent-card.spec.md', example, false],
  ['empty section', R, sub('## Untrusted inputs\n\n- PR title', '## Untrusted inputs\n\n## Junk\n- PR title'), false],
  ['AC without shall', R, sub('the Overview tab shall show\n  the intent card', 'the Overview tab shows\n  the intent card'), false],
  ['AC without EARS trigger', R, sub('**AC-1** [web] WHEN the user', '**AC-1** [web] Once the user'), false],
  ['IF without THEN', R, sub('IF no intent exists for the PR, THEN the', 'IF no intent exists for the PR, the'), false],
  ['AC without Verify', R, sub('above the Description. *Verify: e2e*', 'above the Description.'), false],
  ['AC with bad Verify', R, sub('above the Description. *Verify: e2e*', 'above the Description. *Verify: browser*'), false],
  ['AC without package tag in the cross-module folder', R, sub('**AC-1** [web] WHEN', '**AC-1** WHEN'), false],
  ['AC vague word', R, sub('show\n  the intent card above', 'quickly show\n  the intent card above'), false],
  ['vague word inside quotes is fine', R, sub('"No intent derived yet"', '"Easy start"'), true],
  ['duplicate AC ID', R, sub('**AC-2** [web]', '**AC-1** [web]'), false],
  ['US without AC link', R, sub('before I read findings. → AC-1, AC-2', 'before I read findings.'), false],
  ['US points to unknown AC', R, sub('→ AC-6, AC-7', '→ AC-6, AC-77'), false],
  ['US not in story form', R, sub('**US-3** As a reviewer, I want', '**US-3** Reviewer wants'), false],
  ['EC without IF criterion', R, sub('**EC-1** The PR was never analysed, so no intent exists. → AC-8', '**EC-1** The PR was never analysed, so no intent exists. → AC-1'), false],
  ['NFR without number', R, sub('within 300 ms at p95', 'within a short time at peak'), false],
  ['Assumption without risk', R, sub('Risk if wrong: the server needs a\n  contract change first.', 'That is all.'), false],
  ['Q without kind', R, sub('**Q-1** (non-blocking) Should', '**Q-1** Should'), false],
  ['Traceability row missing', R, sub('| AC-11 | — | EC-4 | — | unit |\n', ''), false],
  ['Traceability unknown ID', R, sub('| AC-2 | US-1 | — | — | unit |', '| AC-2 | US-9 | — | — | unit |'), false],
  ['Traceability Verify differs', R, sub('| AC-3 | US-2 | — | NFR-1 | it |', '| AC-3 | US-2 | — | NFR-1 | unit |'), false],
  ['diagram headings inside a fence are ignored', R, sub('sequenceDiagram', 'sequenceDiagram\n## not a section'), true],
];
const blockingQ = sub('**Q-1** (non-blocking)', '**Q-1** (blocking)');
const markedQ = blockingQ.replace('above the Description. *Verify: e2e*', 'above the Description [NEEDS CLARIFICATION: Q-1]. *Verify: e2e*');
const marker = sub('above the Description. *Verify: e2e*', 'above the Description [NEEDS CLARIFICATION: Q-1]. *Verify: e2e*');
cases.push(
  ['blocking Q with a marker in draft is fine', R, markedQ, true],
  ['blocking Q without a marker', R, blockingQ, false],
  ['blocking Q in approved', R, markedQ.replace('Status: draft', 'Status: approved'), false],
  ['marker in approved', R, marker.replace('Status: draft', 'Status: approved'), false],
  ['marker on a non-blocking Q', R, marker, false],
  ['marker to unknown Q', R, markedQ.replace('[NEEDS CLARIFICATION: Q-1]', '[NEEDS CLARIFICATION: Q-9] [NEEDS CLARIFICATION: Q-1]'), false],
  ['malformed marker', R, markedQ.replace('[NEEDS CLARIFICATION: Q-1]', '[NEEDS CLARIFICATION: Q-1] [NEEDS CLARIFICATION]'), false],
  ['marker inside inline code is ignored', R, sub('above the Description. *Verify: e2e*', 'above the Description `[NEEDS CLARIFICATION]`. *Verify: e2e*'), true],
);

for (const [name, rel, content, wantOk] of cases) {
  test(`lint: ${name}`, () => {
    const errs = lint(content, rel, root());
    assert.equal(errs.length === 0, wantOk, JSON.stringify(errs));
  });
}

test('lint: a global Spec number used by another spec is an error', () => {
  const dir = root({ rel: 'web/.spec/x.spec.md', content: '# Spec: x\nSpec ID: SPEC-00-x\n' });
  assert.ok(lint(example, R, dir).some((e) => /already used/.test(e)));
});

test('lint: config.specs moves the cross-module folder', () => {
  const dir = root(null, '{"specs":"docs/specs/"}');
  assert.deepEqual(lint(example, 'docs/specs/intent-card.spec.md', dir), []);
});

test('lint: package tags must name a configured package when checks lists packages', () => {
  const dir = root(null, '{"checks":{"web":{"test":"npm test"},"api":{"test":"npm test"}}}');
  assert.deepEqual(lint(example, R, dir), []);
  const other = root(null, '{"checks":{"app":{"test":"npm test"}}}');
  assert.ok(lint(example, R, other).some((e) => /package tag/.test(e)));
});

function hook(mode, payload, dir) {
  return spawnSync(process.execPath, [HOOK, mode], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  });
}

test('hook pre: an Edit that approves a broken draft is blocked; other edits pass', () => {
  const dir = root();
  writeFileSync(join(dir, R), example.replace('*Verify: e2e*\n- **AC-2**', '\n- **AC-2**'));
  const blocked = hook('pre', { tool_name: 'Edit', tool_input: { file_path: R, old_string: 'Status: draft', new_string: 'Status: approved' } }, dir);
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /spec-lint/);
  assert.equal(hook('pre', { tool_name: 'Edit', tool_input: { file_path: R, old_string: 'Problem and user', new_string: 'Problem and user' } }, dir).status, 0);
});

test('hook pre: a Write of a clean approved spec is allowed', () => {
  const dir = root();
  const content = example.replace(/intent-card/g, 'new').replace('Status: draft', 'Status: approved').replace('SPEC-00-', 'SPEC-01-');
  assert.equal(hook('pre', { tool_name: 'Write', tool_input: { file_path: 'specs/new.spec.md', content } }, dir).status, 0);
});

test('hook post: a broken draft feeds its errors back; a clean one passes', () => {
  const dir = root();
  writeFileSync(join(dir, R), example.replace('*Verify: e2e*\n- **AC-2**', '\n- **AC-2**'));
  const r = hook('post', { tool_name: 'Edit', tool_input: { file_path: R } }, dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /format error/);
  writeFileSync(join(dir, R), example);
  assert.equal(hook('post', { tool_name: 'Edit', tool_input: { file_path: R } }, dir).status, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('hook post: non-spec paths and specs without a Spec ID line are ignored', () => {
  const dir = root();
  assert.equal(hook('post', { tool_name: 'Write', tool_input: { file_path: 'docs/x.md' } }, dir).status, 0);
  writeFileSync(join(dir, 'specs', 'old.spec.md'), '# Old format\n\n## Goal\n');
  assert.equal(hook('post', { tool_name: 'Edit', tool_input: { file_path: 'specs/old.spec.md' } }, dir).status, 0);
});

test('hook pre: garbage stdin fails open', () => {
  const r = hook('pre', 'garbage', root());
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim().split('\n').length, 1);
});

test('the template states the sections lint enforces', () => {
  const t = readFileSync(join(PLUGIN, 'skills', 'spec-writing', 'template.md'), 'utf8');
  for (const s of ['Problem and user', 'Goals / Non-goals', 'User stories', 'Acceptance criteria (EARS)', 'Module interactions',
    'Edge cases', 'Non-functional requirements', 'Assumptions', 'Inputs and provenance', 'Untrusted inputs', 'Open questions', 'Traceability']) {
    assert.ok(t.includes(`## ${s}`), s);
  }
});
