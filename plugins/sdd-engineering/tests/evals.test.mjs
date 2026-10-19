// sdd-engineering/evals/smoke — its graders check that each plugin loads at its version, so a
// release moves the versions they pin together with plugin.json (missed at 1.0.1's first cut).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginsDir = join(here, '..', '..');
const gradersDir = join(here, '..', 'evals', 'smoke', 'graders');
const version = (name) =>
  JSON.parse(readFileSync(join(pluginsDir, name, '.claude-plugin', 'plugin.json'), 'utf8')).version;

test('every version a smoke grader pins is that plugin\'s plugin.json version', () => {
  const pins = [];
  for (const file of readdirSync(gradersDir)) {
    const text = readFileSync(join(gradersDir, file), 'utf8');
    const m = /"(?:source":"([a-z-]+)@inline|plugin":"([a-z-]+))","version":"([0-9\\.]+)"/.exec(text);
    if (m) pins.push({ file, plugin: m[1] || m[2], pinned: m[3].replace(/\\/g, '') });
  }
  assert.ok(pins.length >= 5, `found ${pins.length} version pins, expected the four loads graders and the trace`);
  for (const { file, plugin, pinned } of pins) {
    assert.equal(pinned, version(plugin), `${file}: pins ${plugin} ${pinned}, plugin.json says ${version(plugin)}`);
  }
});

// sdd-engineering/evals/push-main — the 1.1.0 case: the push is tried and the guard's own line
// is in the trace (the model may repeat the bare marker, so the grader matches the hook line).
test('the push-main case grades the attempt and the push guard\'s block', () => {
  const caseDir = join(here, '..', 'evals', 'push-main');
  const yaml = readFileSync(join(caseDir, 'case.yaml'), 'utf8');
  assert.match(yaml, /^tags: \[v1\.1\.0\]$/m);
  assert.match(yaml, /^ {2}scaffold_script: fixture\.sh$/m);
  assert.match(yaml, /allowed_tools: \[Bash, Read\]/);
  const graders = readdirSync(join(caseDir, 'graders')).map((f) => readFileSync(join(caseDir, 'graders', f), 'utf8'));
  assert.ok(graders.some((g) => /type: tool_used/.test(g) && /tool: Bash/.test(g) && /input_match: 'git push'/.test(g)), 'tool_used Bash git push');
  const block = graders.find((g) => /target: trace/.test(g) && /SDD-PUSH-BLOCKED/.test(g));
  assert.ok(block, 'a trace grader for the block marker');
  assert.ok(block.includes(String.raw`hook error: \[[^\]]*push-guard\.mjs[^\]]*\]: SDD-PUSH-BLOCKED`), block);
  const guard = readFileSync(join(here, '..', 'hooks', 'push-guard.mjs'), 'utf8');
  assert.match(guard, /export const MARKER = 'SDD-PUSH-BLOCKED';/);
});
