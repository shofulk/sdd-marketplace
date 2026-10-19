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
