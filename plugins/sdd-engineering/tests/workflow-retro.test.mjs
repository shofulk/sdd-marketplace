// sdd-engineering/skills/workflow-retro — the run report of a finished run (plan B8, spec §3.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'workflow-retro', 'SKILL.md'), 'utf8');

test('frontmatter names the skill, user-invoked', () => {
  const fm = /^---\n([\s\S]*?)\n---/.exec(skill)[1];
  assert.match(fm, /^name: workflow-retro$/m);
  assert.match(fm, /^description: \S/m);
  assert.match(fm, /^disable-model-invocation: true$/m);
});

test('runs the usage script through the plugin root', () => {
  assert.ok(skill.includes('${CLAUDE_PLUGIN_ROOT}/scripts/usage.mjs'));
});

test('reads the run state and refuses an unfinished run', () => {
  assert.ok(skill.includes('<runs>/<feature>/state.md'));
  assert.match(skill, /`Status:` is not `done`[^\n]*(stop|refuse)/i);
});

test('writes the retro with the five sections', () => {
  for (const s of ['## Outcome', '## What went well', '## What went wrong by class', '## Decisions', '## Plugins']) {
    assert.ok(skill.includes(s), s);
  }
  assert.ok(skill.includes('<retros>/<feature>.md'));
});

test('the Plugins section comes from the state Plugins: line', () => {
  assert.match(skill, /`Plugins:` line/);
});

test('appends one row to the ledger', () => {
  assert.ok(skill.includes('<retros>/ledger.md'));
  assert.match(skill, /one row/i);
});

// A project's existing ledger may carry another table (one install had 14 columns): a row
// appended under it lands in the wrong columns (found in that install's review).
test('an existing ledger with another header stops the append', () => {
  const step3 = skill.slice(skill.indexOf('## Step 3'), skill.indexOf('## Step 4')).replace(/\s+/g, ' ');
  assert.match(step3, /When the file exists, compare its table header with the header below/);
  assert.match(step3, /If they differ, stop/);
  assert.match(step3, /show both headers/i);
  assert.match(step3, /never append a row under a different header/i);
});
