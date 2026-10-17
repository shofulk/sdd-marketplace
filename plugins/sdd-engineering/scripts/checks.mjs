#!/usr/bin/env node
// One run of the package checks for a feature, recorded once and reused by every later reader
// (plan-verifier, architecture-reviewer, the main session) while the tree is unchanged.
//
//   node checks.mjs run <feature> [--quick] [--force] [<pkg>...]
//   node checks.mjs status <feature>        fresh | stale | missing  (exit 0 only when fresh)
//   node checks.mjs fingerprint
//   node checks.mjs changes [<base>]        the change set: base sha, then one path per line
//
// run     For each package (default: every package in .sdd/config.json `checks`), runs its
//         configured commands — typecheck · lint · arch · test, then any other kind the project
//         adds (for example `it`), which --quick skips. Each command runs from the project root
//         with CI=1; its full log goes to <checksDir>/<feature>.logs/<pkg>-<kind>.log, the record
//         to <checksDir>/<feature>.md, and stdout gets one line per command plus the excerpt of
//         the first failure. A record that is fresh, passing and at least as complete as asked
//         is reused, not re-run (--force re-runs anyway). Exit 0 when every command passed.
// The fingerprint is HEAD plus every tracked and untracked change outside *.md, .sdd/ and the
// checks and runs folders, so docs and plans edited after the run do not make it stale.
//
// Ported to Node from checks.sh of the source project (see NOTICE): the packages and their
// commands come from .sdd/config.json instead of being fixed.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../hooks/lib/config.mjs';

const STANDARD = ['typecheck', 'lint', 'arch', 'test'];
const USAGE = 'usage: checks.mjs run <feature> [--quick] [--force] [<pkg>...] | status <feature> | fingerprint | changes [<base>]';

function git(root, args, opts = {}) {
  return execFileSync('git', args, { cwd: root, encoding: opts.encoding ?? 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
}

function projectRoot() {
  try { return git(process.cwd(), ['rev-parse', '--show-toplevel']).trim(); } catch { /* not a git repo */ }
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

const strip = (p) => String(p).replace(/^\.\//, '').replace(/\/+$/, '');

function excludes(config) {
  const out = new Set(['.sdd', strip(config.checksDir || '.sdd/checks/'), strip(config.runs || '.sdd/runs/')]);
  return [...out].filter(Boolean).map((p) => `:(exclude)${p}`);
}

export function fingerprint(root, config) {
  const h = createHash('sha256');
  const ex = [':(exclude)*.md', ...excludes(config)];
  let head = 'no-head';
  try { head = git(root, ['rev-parse', 'HEAD']).trim(); } catch { /* no commit yet */ }
  h.update(head + '\n');
  try { h.update(git(root, ['diff', 'HEAD', '--binary', '--', '.', ...ex], { encoding: 'buffer' })); } catch { /* no HEAD */ }
  let untracked = '';
  try { untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', '.', ...ex]); } catch { /* none */ }
  for (const f of untracked.split('\0').filter(Boolean).sort()) {
    let sha = 'unreadable';
    try { sha = git(root, ['hash-object', '--', f]).trim(); } catch { /* deleted meanwhile */ }
    h.update(`${f} ${sha}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

function paths(root, config) {
  const dir = join(root, strip(config.checksDir || '.sdd/checks/'));
  return { dir, rec: (f) => join(dir, `${f}.md`), logs: (f) => join(dir, `${f}.logs`) };
}

function field(text, name) {
  const m = new RegExp(`^\\*\\*${name}:\\*\\* (.*)$`, 'm').exec(text);
  return m ? m[1].trim() : null;
}

function status(root, config, feature) {
  const rec = paths(root, config).rec(feature);
  if (!existsSync(rec)) return { state: 'missing' };
  const text = readFileSync(rec, 'utf8');
  return { state: field(text, 'Fingerprint') === fingerprint(root, config) ? 'fresh' : 'stale', text };
}

// The useful part of a failing log: a test runner's failure section, else the last 40 lines.
function excerpt(log) {
  const plain = readFileSync(log, 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
  const lines = plain.split('\n');
  const i = lines.findIndex((l) => /Failed Tests|^not ok |FAIL /.test(l));
  return (i >= 0 ? lines.slice(i, i + 60) : lines.slice(-40)).join('\n');
}

function summaryOf(log) {
  const lines = readFileSync(log, 'utf8').replace(/\x1b\[[0-9;]*m/g, '').split('\n');
  const hit = lines.filter((l) => /^\s*Tests\s+\d|^# (pass|fail) \d|\b\d+ (passing|passed|failed|failing)\b|dependency violations|no dependency violations|\berrors?\b.*\bwarnings?\b/i.test(l));
  return (hit.pop() || '').trim().replace(/\|/g, '\\|') || '—';
}

function run(root, config, args) {
  let feature = null;
  let quick = false;
  let force = false;
  const pkgs = [];
  for (const a of args) {
    if (a === '--quick') quick = true;
    else if (a === '--force') force = true;
    else if (!feature) feature = a;
    else pkgs.push(a);
  }
  if (!feature) { console.error(USAGE); return 2; }
  const checks = config.checks && typeof config.checks === 'object' ? config.checks : {};
  const wanted = pkgs.length ? pkgs : Object.keys(checks);
  if (!wanted.length) { console.error('no packages: .sdd/config.json has no `checks` — add the commands, then run again'); return 2; }
  for (const p of wanted) if (!checks[p] || typeof checks[p] !== 'object') { console.error(`unknown package: ${p} (not in .sdd/config.json checks)`); return 2; }

  const { dir, rec, logs } = paths(root, config);
  const mode = quick ? 'quick' : 'full';
  if (!force) {
    const s = status(root, config, feature);
    if (s.state === 'fresh') {
      const had = field(s.text, 'Mode');
      if (field(s.text, 'Result') === 'pass' && (had === 'full' || mode === 'quick') && field(s.text, 'Packages') === wanted.join(' ')) {
        console.log(`reused: ${rec(feature)} is fresh (fingerprint ${field(s.text, 'Fingerprint')}, mode ${had}) — not re-run`);
        return 0;
      }
    }
  }

  mkdirSync(logs(feature), { recursive: true });
  const fp = fingerprint(root, config);
  const rows = [];
  let firstFail = null;
  for (const p of wanted) {
    const kinds = Object.keys(checks[p]).filter((k) => typeof checks[p][k] === 'string' && checks[p][k].trim());
    const ordered = [...STANDARD.filter((k) => kinds.includes(k)), ...kinds.filter((k) => !STANDARD.includes(k))];
    if (!ordered.length) rows.push(`- ${p}: no commands configured`);
    for (const kind of ordered) {
      const cmd = checks[p][kind].trim();
      if (quick && !STANDARD.includes(kind)) {
        rows.push(`- ${p} ${kind}: skipped (quick mode) — \`${cmd}\``);
        continue;
      }
      const log = join(logs(feature), `${p}-${kind}.log`);
      const fd = openSync(log, 'w');
      const t0 = Date.now();
      const r = spawnSync('sh', ['-c', cmd], { cwd: root, stdio: ['ignore', fd, fd], env: { ...process.env, CI: '1' } });
      closeSync(fd);
      const secs = Math.round((Date.now() - t0) / 1000);
      const code = r.status ?? 1;
      const result = code === 0 ? 'pass' : 'fail';
      if (result === 'fail' && !firstFail) firstFail = log;
      const summary = summaryOf(log);
      rows.push(`- ${p} ${kind}: ${result} — \`${cmd}\` (exit ${code}, ${secs}s) — ${summary}`);
      console.log(`${result.padEnd(4)} ${p} ${kind}: ${cmd}  ${secs}s ${summary === '—' ? '' : summary}`);
    }
  }
  const verdict = firstFail ? 'fail' : 'pass';
  let head = 'none';
  try { head = git(root, ['rev-parse', '--short', 'HEAD']).trim(); } catch { /* no commit */ }
  mkdirSync(dir, { recursive: true });
  writeFileSync(rec(feature), [
    `# Checks: ${feature}`,
    '',
    `**Fingerprint:** ${fp}`,
    `**HEAD:** ${head}`,
    `**Mode:** ${mode}`,
    `**Packages:** ${wanted.join(' ')}`,
    `**Result:** ${verdict}`,
    `**Ran at:** ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`,
    '',
    ...rows,
    '',
    `Logs: \`${logs(feature).slice(root.length + 1)}/\`. Reuse this record only while \`checks.mjs status ${feature}\` prints \`fresh\`.`,
    '',
  ].join('\n'));
  console.log(`record: ${rec(feature).slice(root.length + 1)} (${verdict}, fingerprint ${fp})`);
  if (firstFail) {
    console.log(`--- first failure: ${firstFail.slice(root.length + 1)}`);
    console.log(excerpt(firstFail));
    return 1;
  }
  return 0;
}

function changes(root, config, base) {
  let b = base;
  if (!b) {
    for (const ref of ['origin/HEAD', 'origin/main', 'origin/master']) {
      try { b = git(root, ['merge-base', 'HEAD', ref]).trim(); break; } catch { /* no such ref */ }
    }
  }
  if (!b) { try { b = git(root, ['rev-parse', 'HEAD']).trim(); } catch { b = null; } }
  const ex = excludes(config);
  const files = new Set();
  const add = (out) => out.split('\n').map((l) => l.trim()).filter(Boolean).forEach((f) => files.add(f));
  if (b) { try { add(git(root, ['diff', '--name-only', b, '--', '.', ...ex])); } catch { /* bad base */ } }
  try { add(git(root, ['diff', '--name-only', 'HEAD', '--', '.', ...ex])); } catch { /* no HEAD */ }
  try { add(git(root, ['ls-files', '--others', '--exclude-standard', '--', '.', ...ex])); } catch { /* none */ }
  console.log(`Base: ${b ?? 'none'}`);
  for (const f of [...files].sort()) console.log(f);
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === (await import('node:path')).resolve(process.argv[1]);
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const root = projectRoot();
  const { config, errors } = loadConfig(root);
  for (const e of errors) console.error(`checks: ${e}`);
  let code = 2;
  if (cmd === 'run') code = run(root, config, rest);
  else if (cmd === 'status') {
    if (!rest[0]) { console.error('usage: checks.mjs status <feature>'); code = 2; }
    else { const s = status(root, config, rest[0]); console.log(s.state); code = s.state === 'fresh' ? 0 : 1; }
  } else if (cmd === 'fingerprint') { console.log(fingerprint(root, config)); code = 0; }
  else if (cmd === 'changes') code = changes(root, config, rest[0]);
  else console.error(USAGE);
  process.exit(code);
}
