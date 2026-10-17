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
