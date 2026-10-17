// sdd-engineering/hooks/spec-guard.mjs — spec-creator writes only draft spec files (plan B6, spec §3.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'spec-guard.mjs');
const AGENT = 'sdd-engineering:spec-creator';
const DRAFT = '# Spec: x\nSpec ID: SPEC-01-x\nStatus: draft\nSupersedes: none\n';

function project(config) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'sdd-spec-guard-')));
  mkdirSync(join(dir, '.sdd'));
  if (config) writeFileSync(join(dir, '.sdd', 'config.json'), config);
  return dir;
}

function run(dir, { tool = 'Write', file, content = DRAFT, agent = AGENT, extra = {} }) {
  const payload = { hook_event_name: 'PreToolUse', tool_name: tool, agent_type: agent, cwd: dir, tool_input: { file_path: file, content, ...extra } };
  if (agent === null) delete payload.agent_type;
  return spawnSync(process.execPath, [GUARD, '--agents', AGENT], {
    input: JSON.stringify(payload),
    env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  });
}

test('spec-creator may create specs/x.spec.md', () => {
  assert.equal(run(project(), { file: 'specs/x.spec.md' }).status, 0);
});

test('spec-creator may create pkg/.spec/x.spec.md', () => {
  assert.equal(run(project(), { file: 'pkg/.spec/x.spec.md' }).status, 0);
});

test('an absolute path inside the project is judged by its relative form', () => {
  const dir = project();
  assert.equal(run(dir, { file: join(dir, 'specs', 'x.spec.md') }).status, 0);
});

test('spec-creator may not write code', () => {
  const r = run(project(), { file: 'src/a.ts' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /spec-guard/);
});

test('spec-creator may not write a non-spec file in specs/', () => {
  assert.equal(run(project(), { file: 'specs/notes.md' }).status, 2);
});

test('another agent writing code is not judged', () => {
  assert.equal(run(project(), { file: 'src/a.ts', agent: 'sdd-engineering:implementer' }).status, 0);
  assert.equal(run(project(), { file: 'src/a.ts', agent: null }).status, 0);
});

test('config.specs moves the cross-module spec folder', () => {
  const dir = project('{"specs":"docs/specs/"}');
  assert.equal(run(dir, { file: 'docs/specs/x.spec.md' }).status, 0);
  assert.equal(run(dir, { file: 'specs/x.spec.md' }).status, 2);
});

test('nested folders under specs/ and dot-files are refused', () => {
  const dir = project();
  assert.equal(run(dir, { file: 'specs/sub/x.spec.md' }).status, 2);
  assert.equal(run(dir, { file: 'specs/.spec.md' }).status, 2);
  assert.equal(run(dir, { file: 'pkg/.spec/README.md' }).status, 2);
});

test('a path outside the project is refused', () => {
  assert.equal(run(project(), { file: '../elsewhere/specs/x.spec.md' }).status, 2);
});

test('a symlinked spec folder that points outside the project is refused', () => {
  const dir = project();
  const outside = realpathSync(mkdtempSync(join(tmpdir(), 'sdd-outside-')));
  symlinkSync(outside, join(dir, 'specs'));
  assert.equal(run(dir, { file: 'specs/x.spec.md' }).status, 2);
});

test('a new spec must be born a draft', () => {
  assert.equal(run(project(), { file: 'specs/x.spec.md', content: DRAFT.replace('draft', 'approved') }).status, 2);
});

test('Write over an existing spec is refused; Edit of a draft is allowed', () => {
  const dir = project();
  mkdirSync(join(dir, 'specs'));
  writeFileSync(join(dir, 'specs', 'x.spec.md'), DRAFT);
  assert.equal(run(dir, { file: 'specs/x.spec.md' }).status, 2);
  assert.equal(run(dir, { tool: 'Edit', file: 'specs/x.spec.md', extra: { old_string: 'x', new_string: 'y' } }).status, 0);
});

test('an approved spec is frozen', () => {
  const dir = project();
  mkdirSync(join(dir, 'specs'));
  writeFileSync(join(dir, 'specs', 'x.spec.md'), DRAFT.replace('draft', 'approved'));
  const r = run(dir, { tool: 'Edit', file: 'specs/x.spec.md', extra: { old_string: 'x', new_string: 'y' } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Supersedes/);
});

test('malformed stdin fails open with one stderr line', () => {
  const r = spawnSync(process.execPath, [GUARD, '--agents', AGENT], { input: 'nope', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim().split('\n').length, 1);
});
