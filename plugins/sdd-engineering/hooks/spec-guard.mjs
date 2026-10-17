#!/usr/bin/env node
// spec-guard.mjs — PreToolUse(Write|Edit) guard for the spec writer (spec §3.5):
//
//   node spec-guard.mjs --agents sdd-engineering:spec-creator
//
// For a call whose `agent_type` is in --agents it allows a write only to a spec file — a
// direct child `<name>.spec.md` of the cross-module folder (`specs` in .sdd/config.json,
// default `specs/`) or of a folder named `.spec` — that resolves inside the project. A spec is
// born a draft: `Write` only creates a file that does not exist yet and carries a
// `Status: draft` line; `Edit` only changes a file whose current text still says
// `Status: draft`. An approved or implemented spec is frozen; a change is a new spec with
// `Supersedes:`. Every other caller passes untouched.
//
// Exit 2 with the reason on stderr blocks. Fails open on its own errors (unreadable input):
// one stderr line, exit 0. Adapted from the `write spec` profile of the source project's
// scope-guard.sh (see NOTICE).
import fs from 'node:fs';
import path from 'node:path';
import { readHookInput, note } from './lib/hook-input.mjs';
import { loadConfig } from './lib/config.mjs';

const HOOK = 'spec-guard';
const DRAFT_LINE = /^Status:[ \t]*draft[ \t]*$/m;

function agentsArg(argv) {
  const i = argv.indexOf('--agents');
  return i === -1 ? [] : (argv[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean);
}

// Resolve symlinks on the nearest existing ancestor (the target usually does not exist yet).
function realpathNearest(p) {
  let cur = p;
  const tail = [];
  for (let i = 0; i < 64; i++) {
    try { return path.join(fs.realpathSync(cur), ...tail.reverse()); } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return null;
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
  return null;
}

/** The reason a write breaks the spec scope, or null. */
export function verdict({ tool, file, content }, projectDir, config) {
  if (typeof file !== 'string' || !file) return 'no file_path in the tool input';
  let rootReal;
  try { rootReal = fs.realpathSync(projectDir); } catch { return null; }
  const abs = path.isAbsolute(file) ? path.normalize(file) : path.resolve(projectDir, file);
  const real = realpathNearest(abs);
  if (!real || (real !== rootReal && !real.startsWith(rootReal + path.sep))) return `\`${file}\` resolves outside the project`;
  const rel = path.relative(rootReal, real).split(path.sep).join('/');
  const specsDir = String(config.specs || 'specs/').replace(/^\.\//, '').replace(/\/+$/, '');
  const dir = path.posix.dirname(rel);
  const name = path.posix.basename(rel);
  const inSpecFolder = dir === specsDir || dir === '.spec' || dir.endsWith('/.spec');
  if (!inSpecFolder || !name.endsWith('.spec.md') || name.startsWith('.')) {
    return `\`${rel}\` is outside the spec writer's scope (${specsDir}/<feature>.spec.md or <pkg>/.spec/<feature>.spec.md only)`;
  }
  const exists = fs.existsSync(abs);
  if (tool === 'Write') {
    if (exists) return '`Write` over an existing spec — use `Edit` while it is a draft, or write a new spec with `Supersedes:`';
    if (typeof content !== 'string' || !DRAFT_LINE.test(content)) return 'a new spec must carry a `Status: draft` line';
    return null;
  }
  if (tool === 'Edit') {
    if (!exists) return '`Edit` of a spec that does not exist — create it with `Write`';
    let current;
    try { current = fs.readFileSync(abs, 'utf8'); } catch { return 'the current spec could not be read'; }
    if (!DRAFT_LINE.test(current)) return 'the spec is no longer a draft — approved and implemented specs are frozen; write a new spec with `Supersedes:`';
    return null;
  }
  return `\`${tool}\` is not allowed on a spec — only Write (create a draft) and Edit (while draft)`;
}

async function main() {
  const agents = agentsArg(process.argv.slice(2));
  const input = await readHookInput();
  if (!input) { note(HOOK, 'could not read the hook input — allowing'); return 0; }
  if (!input.agent_type || !agents.includes(input.agent_type)) return 0;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const { config, errors } = loadConfig(projectDir);
  for (const e of errors) note(HOOK, e);
  const ti = input.tool_input || {};
  const why = verdict({ tool: input.tool_name, file: ti.file_path ?? ti.notebook_path, content: ti.content }, projectDir, config);
  if (!why) return 0;
  note(HOOK, `blocked for ${input.agent_type}: ${why}.`);
  process.stderr.write('Put needs outside the spec under "Proposed edits outside my scope" in your report.\n');
  return 2;
}

main().then((code) => process.exit(code), (e) => { note(HOOK, `internal error (${e.message}) — allowing`); process.exit(0); });
