#!/usr/bin/env node
// PreToolUse(Bash) guard for named plugin agents (spec §3.5):
//
//   node bash-guard.mjs <profile> --agents <plugin:agent,...>
//
// It judges only calls whose `agent_type` is in --agents; every other caller, the main thread
// included, passes untouched, so several plugins can register it side by side.
//
// Profiles:
//   readonly     allow-list: read-only heads with a per-head argument grammar, read-only git
//                subcommands, no output redirection except /dev/null and fd duplication, no
//                `tee`/`xargs`/`cd`, no command substitution, expansion, escape or unquoted glob.
//   checks       readonly, plus the exact commands of .sdd/config.json `checks` (run from the
//                project root) and `node ${CLAUDE_PLUGIN_ROOT}/scripts/checks.mjs ...`.
//   implementer  deny-list over an otherwise open Bash: no commit, push or other history change,
//                no `git reset --hard` / `git clean`, no `gh pr`, no database migration, no
//                `psql`, no `docker`.
//
// Exit 2 with the reason on stderr blocks the call. The guard fails open on its own errors
// (unreadable input, unknown profile, a crash): one stderr line and exit 0.
//
// Canonical copy: tools/hooklib/ in the sdd-marketplace repository; plugins carry synced copies
// in hooks/lib/ (npm run sync-hooklib). Edit the canonical copy only.
//
// The readonly head and git argument grammars (HEAD_ARGS, GIT_ARGS, the find/sed/echo/printf/test
// checkers, argsGrammarOk) and the implementer deny-list are adapted from scope-guard.sh and
// implementer-guard.sh; the upstream repository, copyright and MIT license are in the plugin's NOTICE.
import { realpathSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { readHookInput, note } from './hook-input.mjs';
import { loadConfig, checkCommands } from './config.mjs';
import { parseCommands } from './shell-words.mjs';

const HOOK = 'bash-guard';
export const PROFILES = ['readonly', 'checks', 'implementer'];

// ---------------------------------------------------------------- readonly grammar

const HEAD_ARGS = {
  ls:       { bool: 'aAlhRtrSd1Fis', value: '', longsExact: new Set(['--all']), operand: 'any' },
  cat:      { bool: 'nbsvetAET', value: '', operand: 'any' },
  head:     { bool: 'q', value: 'nc', numeric: true, operand: 'any' },
  tail:     { bool: 'q', value: 'nc', numeric: true, operand: 'any' },
  wc:       { bool: 'lwcm', value: '', operand: 'any' },
  diff:     { bool: 'qruNbwBisy', value: 'U', longsExact: new Set(['--brief', '--recursive']), longsPrefix: new Set(['--unified=']), operand: 'any' },
  cmp:      { bool: 'slb', value: '', operand: 'any' },
  sort:     { bool: 'rnfhVbdgMmsc', value: 'kt', operand: 'any' },
  uniq:     { bool: 'cdi', value: 'fsw', operand: 'atmost1' },
  cut:      { bool: 's', value: 'dfcb', operand: 'any' },
  tr:       { bool: 'dscC', value: '', operand: 'any' },
  jq:       { bool: 'rcesnjSa', value: '', longsExact: new Set(['--raw-output', '--compact-output', '--slurp', '--null-input', '--tab', '--arg', '--argjson']), longsExtra: { '--arg': 2, '--argjson': 2 }, valueLongs: new Set(['--indent']), operand: 'any' },
  stat:     { bool: 'Lx', value: 'cf', longsPrefix: new Set(['--format=', '--printf=']), operand: 'any' },
  file:     { bool: 'biL', value: '', longsExact: new Set(['--mime-type', '--brief']), operand: 'any' },
  pwd:      { bool: 'LP', value: '', operand: 'none' },
  true:     { bool: '', value: '', operand: 'none' },
  basename: { bool: 'a', value: 's', operand: 'any' },
  dirname:  { bool: '', value: '', operand: 'any' },
  realpath: { bool: 'emqs', value: '', operand: 'any' },
  which:    { bool: 'as', value: '', operand: 'any' },
  rg:       { bool: 'nilcwFvoSHNIsxL', value: 'egtTABCm', longsExact: new Set(['--hidden', '--files', '--no-heading', '--heading', '--count', '--files-with-matches', '--line-number', '--fixed-strings', '--ignore-case', '--smart-case', '--word-regexp', '--invert-match', '--only-matching', '--no-ignore', '--json', '--trim', '--color=never']), valueLongs: new Set(['--glob', '--type', '--max-count', '--sort', '--context', '--max-columns']), operand: 'any' },
  grep:     { bool: 'nilLcwFEvorRHhqsxI', value: 'eABCm', longsExact: new Set(['--color=never']), longsPrefix: new Set(['--include=', '--exclude=', '--exclude-dir=']), operand: 'any' },
};

const GIT_ARGS = {
  status:         { bool: 'sb', value: '', longsExact: new Set(['--short', '--branch', '--ignored', '--porcelain', '--porcelain=v1', '--porcelain=v2']), longsPrefix: new Set(['--untracked-files=']), operand: 'any', dashdash: true },
  diff:           { bool: 'pwM', value: 'U', longsExact: new Set(['--stat', '--shortstat', '--numstat', '--name-only', '--name-status', '--cached', '--staged', '--patch', '--ignore-all-space', '--no-color', '--color=never', '--word-diff', '--find-renames', '--quiet', '--exit-code', '--check']), longsPrefix: new Set(['--unified=', '--diff-filter=']), operand: 'any', dashdash: true },
  log:            { bool: 'p', value: 'nSG', numeric: true, longsExact: new Set(['--oneline', '--stat', '--name-only', '--name-status', '--follow', '--all', '--reverse', '--first-parent', '--no-merges', '--decorate', '--graph']), longsPrefix: new Set(['--max-count=', '--format=', '--pretty=', '--since=', '--until=', '--author=', '--grep=', '--date=', '--diff-filter=']), operand: 'any', dashdash: true },
  show:           { bool: 'sp', value: '', longsExact: new Set(['--stat', '--name-only', '--name-status', '--oneline', '--no-patch']), longsPrefix: new Set(['--format=', '--pretty=']), operand: 'any', dashdash: true },
  grep:           { bool: 'nilwFEcIhH', value: 'e', operand: 'any', dashdash: true },
  'ls-files':     { bool: 'ocdms', value: '', longsExact: new Set(['--others', '--exclude-standard', '--cached', '--deleted', '--modified', '--error-unmatch', '--stage']), operand: 'any', dashdash: true },
  'rev-parse':    { bool: 'q', value: '', longsExact: new Set(['--short', '--abbrev-ref', '--verify', '--show-toplevel', '--is-inside-work-tree']), longsPrefix: new Set(['--short=']), operand: 'any', dashdash: true },
  'merge-base':   { bool: '', value: '', longsExact: new Set(['--is-ancestor', '--fork-point', '--all']), operand: 'any', dashdash: true },
  blame:          { bool: 'wseM', value: 'L', longsExact: new Set(['--porcelain']), operand: 'any', dashdash: true },
  'cat-file':     { bool: 'tspe', value: '', operand: 'any', dashdash: true },
  'check-ignore': { bool: 'qvn', value: '', longsExact: new Set(['--non-matching', '--no-index']), operand: 'any', dashdash: true },
  'hash-object':  { bool: '', value: '', longsExact: new Set(['--no-filters']), operand: 'any', dashdash: true },
};

const FIND_VALUE_FLAGS = new Set(['-name', '-iname', '-path', '-ipath', '-type', '-maxdepth', '-mindepth', '-size', '-mtime', '-newer']);
const FIND_BOOL_FLAGS = new Set(['-empty', '-prune', '-print', '-print0', '-not', '!', '-o', '-or', '-a', '-and']);
function findArgsOk(args) {
  for (let i = 0; i < args.length; i++) {
    const v = args[i];
    if (FIND_VALUE_FLAGS.has(v)) { i++; if (i >= args.length) return false; continue; }
    if (FIND_BOOL_FLAGS.has(v)) continue;
    if (v.startsWith('-')) return false; // -delete, -exec, -ok, -fprint, ...
  }
  return true;
}
const SED_FLAG_FORMS = new Set(['-n', '-nE', '-En']);
const SED_SCRIPT = /^(\d+|\$)(,(\d+|\$))?p$/;
function sedArgsOk(args) {
  if (args.length < 2 || !SED_FLAG_FORMS.has(args[0]) || !SED_SCRIPT.test(args[1])) return false;
  return args.slice(2).every((a) => !a.startsWith('-'));
}
const echoArgsOk = () => true; // every word after the flags is data
const printfArgsOk = (args) => !(args.length && args[0].startsWith('-')); // no -v
const TEST_UNARY = new Set(['-f', '-d', '-e', '-s', '-n', '-z']);
const testArgsOk = (args) => args.every((v) => v === '!' || v === '=' || v === '!=' || TEST_UNARY.has(v) || !v.startsWith('-'));
const CUSTOM_HEADS = { find: findArgsOk, sed: sedArgsOk, echo: echoArgsOk, printf: printfArgsOk, test: testArgsOk };

function shortClusterOk(spec, tok) {
  const chars = tok.slice(1);
  if (!chars.length) return { ok: false };
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (spec.bool.includes(c)) continue;
    if (spec.value.includes(c)) return { ok: true, needsNext: i === chars.length - 1 };
    return { ok: false };
  }
  return { ok: true, needsNext: false };
}

function longFlagOk(spec, tok) {
  if (spec.longsExact && spec.longsExact.has(tok)) return true;
  const eq = tok.indexOf('=');
  return eq !== -1 && !!spec.longsPrefix && spec.longsPrefix.has(tok.slice(0, eq + 1));
}

function argsGrammarOk(spec, args) {
  let i = 0;
  let sawDashDash = false;
  let operands = 0;
  while (i < args.length) {
    const v = args[i];
    if (v === '--') {
      if (!spec.dashdash) return false;
      sawDashDash = true;
      i++;
      continue;
    }
    if (!sawDashDash && v.length > 2 && v.startsWith('--')) {
      const eq = v.indexOf('=');
      const name = eq !== -1 ? v.slice(0, eq) : v;
      if (spec.valueLongs && spec.valueLongs.has(name)) {
        if (eq !== -1) { i++; continue; }
        if (i + 1 >= args.length) return false;
        i += 2;
        continue;
      }
      if (!longFlagOk(spec, v)) return false;
      const extra = spec.longsExtra && spec.longsExtra[v];
      i += extra ? 1 + extra : 1;
      if (i > args.length) return false;
      continue;
    }
    if (!sawDashDash && v.length > 1 && v.startsWith('-')) {
      if (spec.numeric && /^-\d+$/.test(v)) { i++; continue; }
      const r = shortClusterOk(spec, v);
      if (!r.ok) return false;
      i++;
      if (r.needsNext) { if (i >= args.length) return false; i++; }
      continue;
    }
    if (spec.operand === 'none') return false;
    operands++;
    if (spec.operand === 'atmost1' && operands > 1) return false;
    i++;
  }
  return true;
}

const OUTPUT_OPS = /^\d*(>|>>|>\||&>|&>>|>&|<>)$/;
const INPUT_OPS = /^\d*(<|<<<|<&)$/;
const PRE_REJECT = new Set(['--fix', '-u', '--update', '--write', 'tee', 'xargs']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);

function lexerReason(w) {
  if (w.subst) return `command substitution is not allowed: \`${w.v}\``;
  if (w.expand) return `an expansion (\`$\` outside single quotes) is not allowed: \`${w.v}\``;
  if (w.escaped) return `a backslash outside single quotes is not allowed: \`${w.v}\``;
  if (w.glob) return `an unquoted glob character (* ? [) is not allowed: \`${w.v}\` — quote the pattern`;
  return null;
}

function realOrResolved(p) {
  try { return realpathSync(p); } catch { return resolve(p); }
}

function sameDir(a, b) {
  return !!a && !!b && realOrResolved(a) === realOrResolved(b);
}

function canonical(words, assigns) {
  return [...assigns, ...words.map((w) => w.v)].join(' ');
}

// Configured check commands: `whole` holds each command string (whitespace-normalised) for a
// composite command matched as a whole; `simple` the canonical form of each single command.
function configured(ctx) {
  if (!ctx.config) return { whole: new Set(), simple: new Set() };
  if (!ctx.configured) {
    ctx.configured = { whole: new Set(), simple: new Set() };
    for (const { command } of checkCommands(ctx.config)) {
      ctx.configured.whole.add(command.replace(/\s+/g, ' '));
      const parsed = parseCommands(command);
      if (parsed.length === 1 && !parsed[0].redirs.length) ctx.configured.simple.add(canonical(parsed[0].words, parsed[0].assigns));
    }
  }
  return ctx.configured;
}

function checkCwd(ctx) {
  if (ctx.cwd && !sameDir(ctx.cwd, ctx.projectDir)) return `a configured check runs from the project root (cwd: ${ctx.cwd})`;
  return null;
}

function readonlyVerdict(c, profile, ctx, depth) {
  for (const r of c.redirs) {
    if (r.targetWord) { const why = lexerReason(r.targetWord); if (why) return why; }
    if (r.target === null) continue; // fd duplication such as 2>&1
    if (OUTPUT_OPS.test(r.op) && r.target !== '/dev/null') return `output redirection \`${r.op} ${r.target}\` (only /dev/null or an fd duplication like 2>&1)`;
    if (INPUT_OPS.test(r.op) && r.target.startsWith('/dev/') && r.target !== '/dev/null') return `input redirection from \`${r.target}\``;
  }
  const vals = c.words.map((w) => w.v);
  if (profile === 'checks' && vals.length) {
    if (configured(ctx).simple.has(canonical(c.words, c.assigns))) return checkCwd(ctx);
    if (vals[0] === 'node' && vals.length >= 2 && !c.assigns.length && ctx.pluginRoot &&
        realOrResolved(vals[1]) === realOrResolved(join(ctx.pluginRoot, 'scripts', 'checks.mjs'))) {
      for (const w of c.words) { const why = lexerReason(w); if (why) return why; }
      return null;
    }
  }
  if (c.assigns.length && !(c.assigns.length === 1 && c.assigns[0] === 'CI=1')) {
    return `a leading \`${c.assigns.find((a) => a !== 'CI=1')}\` assignment is not allowed (only \`CI=1\`)`;
  }
  if (!c.words.length) return c.assigns.length ? 'an assignment with no command is not allowed' : null;
  for (const w of c.words) { const why = lexerReason(w); if (why) return why; }

  const head = vals[0];
  const args = vals.slice(1);
  if (head.includes('/')) return `a bare command name is required — \`${head}\` contains \`/\``;
  if (SHELLS.has(head)) {
    if (args.length !== 2 || args[0] !== '-c') return `\`${head}\` is allowed only as \`${head} -c <program>\``;
    return evaluate(profile, args[1], ctx, depth + 1);
  }
  if (head === 'eval') {
    if (!args.length) return '`eval` without an operand is not allowed';
    return evaluate(profile, args.join(' '), ctx, depth + 1);
  }
  const pre = vals.find((v) => PRE_REJECT.has(v) || v.startsWith('--output'));
  if (pre) return `\`${pre}\` is not allowed in a read-only profile`;
  if (head === 'git') {
    if (args.some((v) => v === '-C' || v.startsWith('--git-dir') || v.startsWith('--work-tree') || v.startsWith('--exec-path'))) {
      return '`git -C` / `--git-dir` / `--work-tree` / `--exec-path` (another tree) is not allowed';
    }
    let i = 0;
    while (i < args.length && (args[i] === '--no-pager' || args[i] === '-P')) i++;
    const sub = args[i];
    if (!sub || sub.startsWith('-')) return '`git` takes only `--no-pager`/`-P` before a read-only subcommand';
    const spec = GIT_ARGS[sub];
    if (!spec) return `\`git ${sub}\` is not a read-only git subcommand (${Object.keys(GIT_ARGS).join(', ')})`;
    if (!argsGrammarOk(spec, args.slice(i + 1))) return `\`git ${sub}\` arguments are outside its read-only grammar`;
    return null;
  }
  if (CUSTOM_HEADS[head]) return CUSTOM_HEADS[head](args) ? null : `\`${head}\` form is outside its read-only grammar`;
  if (HEAD_ARGS[head]) return argsGrammarOk(HEAD_ARGS[head], args) ? null : `\`${head}\` arguments are outside its read-only grammar`;
  return `\`${head}\` is not in the ${profile} allow-list`;
}

// ---------------------------------------------------------------- implementer deny-list

const WRAPPERS = new Set(['sudo', 'doas', 'command', 'builtin', 'env', 'nice', 'nohup', 'time', 'exec', 'timeout', 'stdbuf', 'xargs']);
const GIT_VALUE_GLOBALS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env', '--super-prefix']);
const GIT_HISTORY = new Set(['commit', 'push', 'merge', 'rebase', 'cherry-pick', 'revert', 'am', 'pull', 'commit-tree', 'update-ref', 'filter-branch', 'filter-repo', 'clean']);
const PACKAGE_RUNNERS = new Set(['npm', 'pnpm', 'yarn', 'bun', 'npx', 'pnpx', 'bunx']);
const MIGRATION_SCRIPT = /^(db:)?(migrate|migration)(s)?(:|$)|^db:push$/;
const MIGRATION_TOOLS = {
  'drizzle-kit': (a) => a[0] === 'migrate' || a[0] === 'push',
  prisma: (a) => a[0] === 'migrate' || (a[0] === 'db' && a[1] === 'push'),
  knex: (a) => /^migrate(:|$)/.test(a[0] ?? ''),
  sequelize: (a) => /^db:migrate/.test(a[0] ?? ''),
  'sequelize-cli': (a) => /^db:migrate/.test(a[0] ?? ''),
  typeorm: (a) => /^migration:run/.test(a[0] ?? '') || /^schema:sync/.test(a[0] ?? ''),
  alembic: (a) => a[0] === 'upgrade' || a[0] === 'downgrade',
  flyway: (a) => a.includes('migrate'),
  liquibase: (a) => a.includes('update'),
  rails: (a) => /^db:(migrate|rollback|schema:load|reset)/.test(a[0] ?? ''),
  rake: (a) => /^db:(migrate|rollback|schema:load|reset)/.test(a[0] ?? ''),
};
const MIGRATION_FILE = /(^|\/)(db\/)?migrat(e|ion|ions)[^/]*\.(c|m)?[jt]s$/;
const RUNNERS = new Set(['node', 'tsx', 'ts-node', 'bun', 'deno']);
const DENIED_HEADS = { psql: 'psql (direct database access)', docker: 'docker', 'docker-compose': 'docker-compose', podman: 'podman' };

function positional(args) {
  return args.filter((a) => !a.startsWith('-'));
}

function implementerVerdict(c, ctx, depth) {
  let w = c.words.map((x) => x.v);
  for (let guard = 0; w.length && guard < 10; guard++) {
    const h = basename(w[0]);
    if (!WRAPPERS.has(h)) break;
    w = w.slice(1);
    while (w.length && (w[0].startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0]) || (h === 'timeout' && /^\d+(\.\d+)?[smhd]?$/.test(w[0])))) w = w.slice(1);
  }
  if (!w.length) return null;
  const head = basename(w[0]);
  const args = w.slice(1);

  if (SHELLS.has(head)) {
    const operands = args.filter((a) => !a.startsWith('-'));
    if (!operands.length) return `\`${head}\` reading its program from stdin cannot be judged — run the commands directly`;
    for (const a of operands) { const r = evaluate('implementer', a, ctx, depth + 1); if (r) return r; }
    return null;
  }
  if (head === 'eval') return evaluate('implementer', args.join(' '), ctx, depth + 1);
  if (DENIED_HEADS[head]) return `${DENIED_HEADS[head]} is outside the implementer's remit`;

  if (head === 'git') {
    let i = 0;
    while (i < args.length && args[i].startsWith('-')) i += GIT_VALUE_GLOBALS.has(args[i]) ? 2 : 1;
    const sub = args[i];
    const rest = args.slice(i + 1);
    if (!sub) return null;
    if (GIT_HISTORY.has(sub)) return `\`git ${sub}\` is outside the implementer's remit`;
    if (sub === 'reset' && rest.includes('--hard')) return '`git reset --hard` is outside the implementer\'s remit';
    if (sub === 'tag' && positional(rest).length && !rest.includes('-l') && !rest.includes('--list')) return '`git tag` (creating a tag) is outside the implementer\'s remit';
    return null;
  }
  if (head === 'gh' && positional(args)[0] === 'pr') return '`gh pr` is outside the implementer\'s remit';
  if (PACKAGE_RUNNERS.has(head)) {
    const pos = positional(args);
    if (pos.some((a) => MIGRATION_SCRIPT.test(a))) return 'a database migration is outside the implementer\'s remit';
    const tool = pos.findIndex((a) => MIGRATION_TOOLS[a]);
    if (tool !== -1 && MIGRATION_TOOLS[pos[tool]](pos.slice(tool + 1))) return `\`${pos[tool]} ${pos[tool + 1] ?? ''}\` (a migration) is outside the implementer's remit`;
    if (pos.some((a) => MIGRATION_FILE.test(a))) return 'a database migration is outside the implementer\'s remit';
  }
  if (MIGRATION_TOOLS[head] && MIGRATION_TOOLS[head](positional(args))) return `\`${head} ${positional(args)[0] ?? ''}\` (a migration) is outside the implementer's remit`;
  if (RUNNERS.has(head) && args.some((a) => MIGRATION_FILE.test(a))) return 'a database migration is outside the implementer\'s remit';
  return null;
}

// ---------------------------------------------------------------- entry points

/**
 * The reason `command` breaks `profile`, or null when it is allowed.
 * ctx: { projectDir, pluginRoot, cwd, config }.
 */
export function evaluate(profile, command, ctx, depth = 0) {
  if (depth > 5) return 'command nesting is too deep to judge';
  if (profile === 'checks' && depth === 0 && configured(ctx).whole.has(String(command).trim().replace(/\s+/g, ' '))) {
    return checkCwd(ctx);
  }
  for (const c of parseCommands(command)) {
    const why = profile === 'implementer' ? implementerVerdict(c, ctx, depth) : readonlyVerdict(c, profile, ctx, depth);
    if (why) return why;
  }
  return null;
}

function parseArgs(argv) {
  const profile = argv[0];
  const i = argv.indexOf('--agents');
  const agents = i === -1 ? [] : (argv[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return { profile, agents };
}

async function main() {
  const { profile, agents } = parseArgs(process.argv.slice(2));
  const input = await readHookInput();
  if (!input) { note(HOOK, 'could not read the hook input — allowing'); return 0; }
  if (!PROFILES.includes(profile)) { note(HOOK, `unknown profile "${profile}" — allowing`); return 0; }
  if (input.tool_name !== 'Bash') return 0;
  if (!input.agent_type || !agents.includes(input.agent_type)) return 0;
  const command = input.tool_input?.command;
  if (typeof command !== 'string') return 0;

  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const { config, errors } = profile === 'checks' ? loadConfig(projectDir) : { config: null, errors: [] };
  for (const e of errors) note(HOOK, e);
  const ctx = { projectDir, pluginRoot: process.env.CLAUDE_PLUGIN_ROOT, cwd: input.cwd, config };
  const why = evaluate(profile, command, ctx);
  if (!why) return 0;
  note(HOOK, `blocked for ${input.agent_type} (${profile}): ${why}.`);
  if (profile === 'implementer') {
    process.stderr.write('Commits, pushes, pull requests, migrations and containers are the main session\'s, after review. Note what is needed under "Open issues" in your report and continue.\n');
  } else {
    process.stderr.write(`This agent's Bash is ${profile === 'checks' ? 'read-only plus the configured checks' : 'read-only'}; run from the project root without cd, quote patterns, and use the Read/Grep/Glob tools for files.\n`);
  }
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}` || basename(process.argv[1] || '') === 'bash-guard.mjs') {
  main().then((code) => process.exit(code), (e) => { note(HOOK, `internal error (${e.message}) — allowing`); process.exit(0); });
}
