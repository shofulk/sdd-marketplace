#!/usr/bin/env node
// push-guard.mjs — PreToolUse(Bash) guard: no `git push` to the default branch (1.1.0, spec §3.8).
//
//   node push-guard.mjs
//
// It judges every caller, the main thread and every subagent alike. A push is blocked when it
// would update the default branch:
//   - a refspec whose destination is the default branch (`main`, `+main`, `HEAD:main`,
//     `refs/heads/main`, `:main`, a `*` pattern that covers it), with or without `--delete`;
//   - `--all`, `--branches` or `--mirror`;
//   - no refspec, or the bare `HEAD`, while the current branch is the default branch.
// The default branch is `refs/remotes/<remote>/HEAD` (remote: the push's, else `origin`), else
// `main`. A refspec or remote the guard cannot read (`$VAR`, `$(...)`) is blocked: spell it out.
// `--no-verify` changes nothing — this is Claude Code's hook, not git's. Commands are found by
// the shared tokenizer (chains, `bash -c`, `eval`, `env`/`command` wrappers, `git -C`, a
// preceding `cd`); git aliases are not expanded. Pushes from a terminal outside Claude Code are
// outside any hook.
//
// Exit 2 blocks, with `SDD-PUSH-BLOCKED: <reason>` on stderr. Fails open on its own errors
// (unreadable input, a crash): one stderr line, exit 0.
import { spawnSync } from 'node:child_process';
import { resolve, basename } from 'node:path';
import { readHookInput, note } from './lib/hook-input.mjs';
import { parseCommands } from './lib/shell-words.mjs';

const HOOK = 'push-guard';
export const MARKER = 'SDD-PUSH-BLOCKED';

const WRAPPERS = new Set(['sudo', 'doas', 'command', 'builtin', 'env', 'nice', 'nohup', 'time', 'exec', 'timeout', 'stdbuf']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);
const GIT_VALUE_GLOBALS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env', '--super-prefix']);
const PUSH_VALUE_OPTIONS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);
const ALL_BRANCHES = new Set(['--all', '--branches', '--mirror']);

function gitOut(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function defaultBranch(cwd, remote) {
  const ref = gitOut(cwd, ['symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`]);
  const prefix = `refs/remotes/${remote}/`;
  return ref && ref.startsWith(prefix) ? ref.slice(prefix.length) : 'main';
}

const unreadable = (w) => w.expand || w.subst;

// Does the destination side of `spec` name `branch`?
function hitsBranch(spec, branch, current) {
  const s = spec.startsWith('+') ? spec.slice(1) : spec;
  const colon = s.indexOf(':');
  let dst = colon === -1 ? s : s.slice(colon + 1);
  if (colon !== -1 && dst === '') return false; // git rejects `src:` as an invalid refspec (git 2.53)
  if (colon === -1 && (dst === 'HEAD' || dst === '@')) dst = current ?? '';
  const name = dst.startsWith('refs/heads/') ? dst.slice('refs/heads/'.length) : dst;
  if (name.includes('*')) {
    const re = new RegExp(`^${name.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    return (dst.startsWith('refs/heads/') || !dst.startsWith('refs/')) && re.test(branch);
  }
  return name === branch;
}

/** The reason one `git push` (its words after `push`) breaks the rule, or null. */
function pushVerdict(words, cwd) {
  const positional = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.v === '--') { positional.push(...words.slice(i + 1)); break; }
    if (w.v.startsWith('-') && !w.expand) {
      if (ALL_BRANCHES.has(w.v)) return `\`git push ${w.v}\` updates every branch, the default branch included`;
      if (PUSH_VALUE_OPTIONS.has(w.v)) i++;
      continue;
    }
    positional.push(w);
  }
  const [remoteWord, ...specs] = positional;
  if (remoteWord && unreadable(remoteWord)) return `the remote \`${remoteWord.v}\` is not spelled out, so the push cannot be judged`;
  const remote = remoteWord?.v || 'origin';
  const branch = defaultBranch(cwd, remote);
  const current = gitOut(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  if (!specs.length) {
    return current === branch ? `\`git push\` with no refspec pushes the current branch \`${branch}\`, the default branch` : null;
  }
  for (const w of specs) {
    if (unreadable(w)) return `the refspec \`${w.v}\` is not spelled out, so the push cannot be judged`;
    if (hitsBranch(w.v, branch, current)) return `the refspec \`${w.v}\` updates \`${branch}\`, the default branch`;
  }
  return null;
}

function unwrap(words) {
  let w = words;
  for (let guard = 0; w.length && guard < 10; guard++) {
    const h = basename(w[0].v);
    if (!WRAPPERS.has(h)) break;
    w = w.slice(1);
    while (w.length && (w[0].v.startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0].v) || (h === 'timeout' && /^\d+(\.\d+)?[smhd]?$/.test(w[0].v)))) w = w.slice(1);
  }
  return w;
}

/**
 * The reason `command`, run from `cwd`, would push to the default branch, or null.
 */
export function evaluate(command, cwd, depth = 0) {
  if (depth > 5) return null;
  let here = cwd;
  for (const c of parseCommands(command)) {
    const w = unwrap(c.words);
    if (!w.length) continue;
    const head = basename(w[0].v);
    const args = w.slice(1);
    if (head === 'cd' && !c.nested) {
      const target = args.find((a) => !a.v.startsWith('-'));
      if (target && !unreadable(target)) here = resolve(here, target.v);
      continue;
    }
    if (SHELLS.has(head)) {
      for (const a of args.filter((a) => !a.v.startsWith('-'))) { const r = evaluate(a.v, here, depth + 1); if (r) return r; }
      continue;
    }
    if (head === 'eval') { const r = evaluate(args.map((a) => a.v).join(' '), here, depth + 1); if (r) return r; continue; }
    if (head !== 'git') continue;
    let dir = here;
    let i = 0;
    while (i < args.length && args[i].v.startsWith('-')) {
      if (args[i].v === '-C' && args[i + 1]) dir = resolve(dir, args[i + 1].v);
      i += GIT_VALUE_GLOBALS.has(args[i].v) ? 2 : 1;
    }
    if (args[i]?.v !== 'push') continue;
    const why = pushVerdict(args.slice(i + 1), dir);
    if (why) return why;
  }
  return null;
}

async function main() {
  const input = await readHookInput();
  if (!input) { note(HOOK, 'could not read the hook input — allowing'); return 0; }
  if (input.tool_name !== 'Bash') return 0;
  const command = input.tool_input?.command;
  if (typeof command !== 'string') return 0;
  const why = evaluate(command, input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (!why) return 0;
  process.stderr.write(`${MARKER}: ${why}. sdd-engineering blocks every push to the default branch from Claude Code, ` +
    '`--no-verify` included. Push a feature branch and open a pull request.\n');
  return 2;
}

main().then((code) => process.exit(code), (e) => { note(HOOK, `internal error (${e.message}) — allowing`); process.exit(0); });
