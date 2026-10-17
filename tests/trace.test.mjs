// tools/hooklib/trace.mjs — the SessionStart trace hook (plan B2, spec §3.8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TRACE = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'hooklib', 'trace.mjs');

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'sdd-trace-'));
  const pluginRoot = join(base, 'plugin');
  mkdirSync(join(pluginRoot, '.claude-plugin'), { recursive: true });
  writeFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), '{"name":"p","version":"1.2.3"}');
  const projectDir = join(base, 'my project');
  mkdirSync(projectDir);
  return { pluginRoot, projectDir };
}

function run(env, stdin) {
  return spawnSync(process.execPath, [TRACE], {
    input: stdin,
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  });
}

const lines = (projectDir) =>
  readFileSync(join(projectDir, '.sdd', 'trace.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('appends one record to .sdd/trace.jsonl in a project path with a space', () => {
  const { pluginRoot, projectDir } = setup();
  const r = run({ CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_PROJECT_DIR: projectDir },
    '{"session_id":"s1","hook_event_name":"SessionStart"}');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '', 'SessionStart stdout becomes context; the hook prints nothing');
  const recs = lines(projectDir);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].session_id, 's1');
  assert.equal(recs[0].plugin, 'p');
  assert.equal(recs[0].version, '1.2.3');
  assert.match(recs[0].time, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/);
  assert.deepEqual(Object.keys(recs[0]).sort(), ['plugin', 'session_id', 'time', 'version']);
});

test('a second session appends, it does not overwrite', () => {
  const { pluginRoot, projectDir } = setup();
  const env = { CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_PROJECT_DIR: projectDir };
  run(env, '{"session_id":"s1"}');
  run(env, '{"session_id":"s2"}');
  assert.deepEqual(lines(projectDir).map((r) => r.session_id), ['s1', 's2']);
});

test('bad stdin → exit 0, record written with session_id null', () => {
  const { pluginRoot, projectDir } = setup();
  const r = run({ CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_PROJECT_DIR: projectDir }, '{not json');
  assert.equal(r.status, 0);
  const recs = lines(projectDir);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].session_id, null);
  assert.equal(recs[0].version, '1.2.3');
});

test('unreadable plugin.json → exit 0 with one stderr line, nothing written', () => {
  const { projectDir } = setup();
  const r = run({ CLAUDE_PLUGIN_ROOT: join(projectDir, 'nowhere'), CLAUDE_PROJECT_DIR: projectDir }, '{"session_id":"s1"}');
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim().split('\n').length, 1);
  assert.ok(!existsSync(join(projectDir, '.sdd', 'trace.jsonl')));
});
