// The project contract: .sdd/config.json in the host project (spec §3.4).
// Canonical copy: tools/hooklib/ in the sdd-marketplace repository; plugins carry synced copies
// in hooks/lib/ (npm run sync-hooklib). Edit the canonical copy only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Defaults for every key. `checks` maps a package name to the commands the checks gate runs and
 * the Bash guards allow: { "<pkg>": { "typecheck"?, "lint"?, "test"?, "arch"? : "<command>" } }.
 */
export const DEFAULTS = Object.freeze({
  context: [],
  specs: 'specs/',
  plans: 'docs/plans/',
  runs: '.sdd/runs/',
  checks: {},
  routing: null,
  agents: [],
  skills: {},
  checksDir: '.sdd/checks/',
  retros: 'docs/retros/',
});

export const CONFIG_PATH = join('.sdd', 'config.json');

const copy = (v) => JSON.parse(JSON.stringify(v));

/**
 * Loads `<projectDir>/.sdd/config.json` merged over DEFAULTS (shallow, per key).
 * A missing file is not an error. Invalid JSON or a non-object document yields the defaults and one
 * error string. Never throws.
 * @returns {{ config: object, errors: string[] }}
 */
export function loadConfig(projectDir) {
  const config = copy(DEFAULTS);
  const errors = [];
  let text;
  try {
    text = readFileSync(join(projectDir || '.', CONFIG_PATH), 'utf8');
  } catch (e) {
    if (e && e.code !== 'ENOENT') errors.push(`${CONFIG_PATH}: unreadable (${e.code || e.message}) — using defaults`);
    return { config, errors };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    errors.push(`${CONFIG_PATH}: invalid JSON (${e.message}) — using defaults`);
    return { config, errors };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push(`${CONFIG_PATH}: not a JSON object — using defaults`);
    return { config, errors };
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined) config[key] = value;
  }
  return { config, errors };
}

/** Every configured check command, as `{ pkg, kind, command }`, skipping non-string values. */
export function checkCommands(config) {
  const out = [];
  const checks = config && typeof config.checks === 'object' && config.checks ? config.checks : {};
  for (const [pkg, kinds] of Object.entries(checks)) {
    if (!kinds || typeof kinds !== 'object') continue;
    for (const [kind, command] of Object.entries(kinds)) {
      if (typeof command === 'string' && command.trim()) out.push({ pkg, kind, command: command.trim() });
    }
  }
  return out;
}
