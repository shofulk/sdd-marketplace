// sdd-engineering/README.md — the host setup a project needs (E2E-2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const readme = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md'), 'utf8');

test('README gives the .gitignore lines that keep run state and the trace out of git', () => {
  assert.match(readme, /^\.sdd\/\*$/m);
  assert.match(readme, /^!\.sdd\/config\.json$/m);
});

// Measured on a real project's install, 2026-10-18: what a project's settings do and do not do.
const flat = readme.replace(/\s+/g, ' ');
const settingsBlock = () => {
  const blocks = [...readme.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  const block = blocks.find((b) => b.includes('"extraKnownMarketplaces"'));
  assert.ok(block, 'README has a project settings JSON block');
  return JSON.parse(block);
};

test('the project settings example enables the three dependencies too', () => {
  const enabled = Object.keys(settingsBlock().enabledPlugins).sort();
  assert.deepEqual(enabled, [
    'architecture-review@sdd-stable', 'engineering-paved-path@sdd-stable',
    'research-tools@sdd-stable', 'sdd-engineering@sdd-stable',
  ]);
});

test('README says project settings alone do not install the plugins, and gives the commands', () => {
  assert.match(flat, /`claude -p` session does not install/);
  assert.ok(readme.includes('claude plugin marketplace add shofulk/sdd-marketplace#stable'));
  assert.ok(readme.includes('claude plugin install sdd-engineering@sdd-stable --scope project'));
});

test('README warns that removing the marketplace also clears the project settings', () => {
  assert.match(flat, /`claude plugin marketplace remove sdd-stable` [^.]*clears the project's `enabledPlugins`/);
});

test('README no longer says the stable branch is still to be created', () => {
  assert.doesNotMatch(flat, /The `stable` branch is created at the first release/);
});
