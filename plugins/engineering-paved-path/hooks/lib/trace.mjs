#!/usr/bin/env node
// SessionStart hook: appends {time, session_id, plugin, version} to
// $CLAUDE_PROJECT_DIR/.sdd/trace.jsonl — the version of the plugin copy that actually loaded,
// read from ${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json (spec §3.8). Each plugin ships this
// hook because a plugin can read only its own root.
// Canonical copy: tools/hooklib/ in the sdd-marketplace repository; plugins carry synced copies
// in hooks/lib/ (npm run sync-hooklib). Edit the canonical copy only.
//
// Prints nothing on stdout (SessionStart stdout becomes session context). Fails open: any error
// is one stderr line and exit 0.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readHookInput, note } from './hook-input.mjs';

const HOOK = 'sdd-trace';

async function main() {
  const input = await readHookInput();
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input?.cwd;
  if (!pluginRoot || !projectDir) {
    note(HOOK, 'CLAUDE_PLUGIN_ROOT or CLAUDE_PROJECT_DIR is not set — no trace written');
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
  } catch (e) {
    note(HOOK, `cannot read ${join(pluginRoot, '.claude-plugin', 'plugin.json')} (${e.code || e.message}) — no trace written`);
    return;
  }
  const record = {
    time: new Date().toISOString(),
    session_id: typeof input?.session_id === 'string' ? input.session_id : null,
    plugin: manifest.name ?? null,
    version: manifest.version ?? null,
  };
  const dir = join(projectDir, '.sdd');
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, 'trace.jsonl'), JSON.stringify(record) + '\n');
}

main().catch((e) => note(HOOK, `failed (${e.message}) — continuing`)).finally(() => process.exit(0));
