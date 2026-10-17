// sdd-engineering/scripts/checks.mjs — the recorded checks gate (plan B7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKS = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'checks.mjs');
const CONFIG = {
  checks: {
    app: { test: 'node -e "process.exit(0)"' },
    bad: { test: 'node -e "process.exit(3)"' },
  },
};

function repo() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'sdd-checks-')));
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...a], { cwd: dir, stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  mkdirSync(join(dir, '.sdd'));
  writeFileSync(join(dir, '.sdd', 'config.json'), JSON.stringify(CONFIG));
  writeFileSync(join(dir, 'index.js'), 'export const x = 1;\n');
  writeFileSync(join(dir, 'README.md'), '# r\n');
  writeFileSync(join(dir, '.gitignore'), '.sdd/*\n!.sdd/config.json\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  return dir;
}

const run = (dir, ...args) => spawnSync(process.execPath, [CHECKS, ...args], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH } });
const record = (dir, feature) => readFileSync(join(dir, '.sdd', 'checks', `${feature}.md`), 'utf8');

test('run: a passing package exits 0 and records `app test: pass`', () => {
  const dir = repo();
  const r = run(dir, 'run', 'f', 'app');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(record(dir, 'f'), /app test: pass/);
  assert.match(record(dir, 'f'), /^\*\*Result:\*\* pass$/m);
  assert.ok(existsSync(join(dir, '.sdd', 'checks', 'f.logs', 'app-test.log')));
});

test('run: a failing package exits non-zero and records `bad test: fail`', () => {
  const dir = repo();
  const r = run(dir, 'run', 'f', 'bad');
  assert.notEqual(r.status, 0);
  assert.match(record(dir, 'f'), /bad test: fail/);
  assert.match(r.stdout, /first failure/);
});

test('status: fresh after a pass, still fresh after a .md edit, stale after a tracked .js edit', () => {
  const dir = repo();
  assert.equal(run(dir, 'run', 'f', 'app').status, 0);
  let s = run(dir, 'status', 'f');
  assert.equal(s.stdout.trim(), 'fresh');
  assert.equal(s.status, 0);
  writeFileSync(join(dir, 'README.md'), '# r\nmore\n');
  assert.equal(run(dir, 'status', 'f').stdout.trim(), 'fresh');
  writeFileSync(join(dir, 'index.js'), 'export const x = 2;\n');
  s = run(dir, 'status', 'f');
  assert.equal(s.stdout.trim(), 'stale');
  assert.notEqual(s.status, 0);
});

test('status: an untracked source file makes the record stale', () => {
  const dir = repo();
  run(dir, 'run', 'f', 'app');
  writeFileSync(join(dir, 'new.js'), '1;\n');
  assert.equal(run(dir, 'status', 'f').stdout.trim(), 'stale');
});

test('status: a feature that never ran is missing', () => {
  const dir = repo();
  const s = run(dir, 'status', 'g');
  assert.equal(s.stdout.trim(), 'missing');
  assert.notEqual(s.status, 0);
});

test('run: a fresh passing record is reused unless --force', () => {
  const dir = repo();
  run(dir, 'run', 'f', 'app');
  assert.match(run(dir, 'run', 'f', 'app').stdout, /reused/);
  assert.doesNotMatch(run(dir, 'run', 'f', '--force', 'app').stdout, /reused/);
});

test('run: no package arguments runs every configured package', () => {
  const dir = repo();
  const r = run(dir, 'run', 'all');
  assert.notEqual(r.status, 0);
  const rec = record(dir, 'all');
  assert.match(rec, /app test: pass/);
  assert.match(rec, /bad test: fail/);
});

test('run: an unknown package is a usage error', () => {
  const r = run(repo(), 'run', 'f', 'nope');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown package/);
});

test('fingerprint prints a stable 16-hex digest', () => {
  const dir = repo();
  const a = run(dir, 'fingerprint').stdout.trim();
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(run(dir, 'fingerprint').stdout.trim(), a);
});

test('changes lists the change set outside .sdd/', () => {
  const dir = repo();
  writeFileSync(join(dir, 'index.js'), 'export const x = 3;\n');
  writeFileSync(join(dir, 'added.js'), '1;\n');
  const out = run(dir, 'changes').stdout;
  assert.match(out, /^Base: [0-9a-f]{7,}/m);
  assert.match(out, /^index\.js$/m);
  assert.match(out, /^added\.js$/m);
  assert.doesNotMatch(out, /\.sdd\//);
});
