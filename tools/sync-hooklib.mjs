#!/usr/bin/env node
// Copies every tools/hooklib/*.mjs into each plugins/*/hooks/lib/ and removes stale .mjs files
// there, so each plugin ships an identical copy (a plugin cannot reference files outside its root).
// Run after editing tools/hooklib: `npm run sync-hooklib`. tests/repo-rules.test.mjs checks the copies.
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'tools', 'hooklib');
const files = readdirSync(source).filter((n) => n.endsWith('.mjs')).sort();
const pluginsDir = join(root, 'plugins');

for (const plugin of readdirSync(pluginsDir).sort()) {
  if (!statSync(join(pluginsDir, plugin)).isDirectory()) continue;
  const lib = join(pluginsDir, plugin, 'hooks', 'lib');
  mkdirSync(lib, { recursive: true });
  for (const stale of readdirSync(lib).filter((n) => !files.includes(n))) rmSync(join(lib, stale), { force: true });
  for (const f of files) copyFileSync(join(source, f), join(lib, f));
  console.log(`${plugin}/hooks/lib: ${files.length} files`);
}
