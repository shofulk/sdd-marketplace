#!/usr/bin/env node
// spec-lint.mjs — deterministic format check for feature specs. The format of record is
// skills/spec-writing/template.md in this plugin. Wired from hooks/hooks.json on Write|Edit.
//
//   node spec-lint.mjs check <file>...  — lint files, print errors, exit 1 if any
//   node spec-lint.mjs pre              — PreToolUse(Write|Edit): computes the content the tool
//                                         would produce; blocks (exit 2) only when that content
//                                         is `approved`/`implemented` and has a lint error, so a
//                                         broken spec is never frozen
//   node spec-lint.mjs post             — PostToolUse(Write|Edit): lints the file on disk; exit 2
//                                         feeds the errors back to the agent, the draft stays
//                                         editable
//
// Scope: `<specs>/*.spec.md` (cross-module specs; `specs` from .sdd/config.json, default
// `specs/`) and `<pkg>/.spec/*.spec.md` (one-package specs), and only files that carry a
// `Spec ID:` line (specs written before the format are left alone). FAIL-OPEN on an internal
// error (unparsable hook JSON, unreadable file): exit 0 with one line on stderr. spec-guard.mjs
// owns the write boundary; this hook judges only format.
//
// Adapted from spec-lint.mjs of the source project (see NOTICE): the package list and spec
// folders come from .sdd/config.json instead of being fixed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';

const SECTIONS_BASE = [
  'Problem and user',
  'Goals / Non-goals',
  'User stories',
  'Acceptance criteria (EARS)',
  'Edge cases',
  'Non-functional requirements',
  'Assumptions',
  'Inputs and provenance',
  'Untrusted inputs',
  'Open questions',
  'Traceability',
];
const ITEM_PREFIX = {
  'User stories': 'US',
  'Acceptance criteria (EARS)': 'AC',
  'Edge cases': 'EC',
  'Non-functional requirements': 'NFR',
  'Assumptions': 'A',
  'Open questions': 'Q',
};
const VERIFY = '(?:unit|it|e2e|manual)(?: \\+ (?:unit|it|e2e|manual))*';
const VERIFY_RE = new RegExp(`\\*Verify: (${VERIFY})\\*\\s*$`);
const VAGUE = ['fast', 'quickly', 'nice', 'properly', 'user-friendly', 'intuitive', 'easy',
  'easily', 'robust', 'seamless', 'seamlessly', 'appropriate', 'as needed', 'etc'];
const VAGUE_RE = new RegExp(`\\b(${VAGUE.map((v) => v.replace(/[-\s]/g, (m) => (m === '-' ? '\\-' : '\\s+'))).join('|')})\\b`, 'i');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.sdd', '.turbo', 'out']);

/** The spec layout of a project: the cross-module folder and the known package names. */
export function specLayout(root) {
  const { config } = loadConfig(root);
  const specsDir = String(config.specs || 'specs/').replace(/^\.\//, '').replace(/\/+$/, '');
  const packages = config.checks && typeof config.checks === 'object' ? Object.keys(config.checks) : [];
  return { specsDir, packages };
}

function isCrossModule(rel, layout) {
  return rel.startsWith(layout.specsDir + '/');
}

/** A path lint judges: a direct child `*.spec.md` of the cross-module folder or of a `.spec` folder. */
export function isSpecPath(rel, layout) {
  if (!rel.endsWith('.spec.md')) return false;
  const dir = path.posix.dirname(rel);
  return dir === layout.specsDir || dir === '.spec' || dir.endsWith('/.spec');
}

function expectedSections(rel, layout) {
  if (!isCrossModule(rel, layout)) return SECTIONS_BASE;
  const s = [...SECTIONS_BASE];
  s.splice(s.indexOf('Acceptance criteria (EARS)') + 1, 0, 'Module interactions');
  return s;
}

// Strip fenced code blocks (``` or ````), keep line numbers.
function unfenced(lines) {
  let fence = null;
  return lines.map((l) => {
    const m = l.match(/^\s*(`{3,})/);
    if (m) {
      if (fence === null) { fence = m[1]; return ''; }
      if (m[1].length >= fence.length) { fence = null; return ''; }
    }
    return fence === null ? l : '';
  });
}

/** Format errors of `content` as the spec at project-relative path `rel`. */
export function lint(content, rel, root) {
  const layout = specLayout(root);
  const errs = [];
  const lines = content.split(/\r?\n/);
  const slug = path.basename(rel).replace(/\.spec\.md$/, '');

  // -- header --
  if (!/^# Spec: \S/.test(lines[0] || '')) errs.push('line 1 must be `# Spec: <feature name>`');
  const head = lines.slice(0, 8);
  const idLine = head.find((l) => l.startsWith('Spec ID:'));
  const idM = idLine && idLine.match(/^Spec ID: SPEC-(\d{2,})-([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/);
  if (!idM) errs.push('missing or malformed `Spec ID: SPEC-NN-<feature>` in the header');
  else if (idM[2] !== slug) errs.push(`Spec ID slug \`${idM[2]}\` must equal the file name \`${slug}\``);
  const stLine = head.find((l) => l.startsWith('Status:'));
  const stM = stLine && stLine.match(/^Status: (draft|approved|implemented)\s*$/);
  if (!stM) errs.push('missing or malformed `Status: draft | approved | implemented` in the header');
  const status = stM ? stM[1] : null;
  const supLine = head.find((l) => l.startsWith('Supersedes:'));
  if (!supLine || !/^Supersedes: (none|\S+ \(SPEC-\d{2,}-[a-z0-9-]+\))\s*$/.test(supLine)) {
    errs.push('missing or malformed `Supersedes: none | <path> (SPEC-NN-<feature>)` in the header');
  }

  // -- the global number is unique across the project --
  if (idM && root) {
    for (const f of listSpecs(root, layout)) {
      if (f === rel) continue;
      let txt;
      try { txt = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }
      const m = txt.match(/^Spec ID: SPEC-(\d{2,})-/m);
      if (m && Number(m[1]) === Number(idM[1])) errs.push(`Spec number ${idM[1]} is already used by \`${f}\``);
    }
  }

  // -- sections --
  const plain = unfenced(lines);
  const secs = [];
  plain.forEach((l, i) => { const m = l.match(/^## (.+?)\s*$/); if (m) secs.push({ name: m[1], line: i }); });
  const want = expectedSections(rel, layout);
  const got = secs.map((s) => s.name);
  if (got.join('\n') !== want.join('\n')) {
    const missing = want.filter((w) => !got.includes(w));
    const extra = got.filter((g) => !want.includes(g));
    let msg = 'sections must be exactly, in order: ' + want.join(' · ');
    if (missing.length) msg += ` — missing: ${missing.join(', ')}`;
    if (extra.length) msg += ` — unexpected: ${extra.join(', ')}`;
    if (!missing.length && !extra.length) msg += ' — wrong order';
    errs.push(msg);
  }
  const body = {};
  secs.forEach((s, k) => {
    const end = k + 1 < secs.length ? secs[k + 1].line : lines.length;
    body[s.name] = { start: s.line + 1, plain: plain.slice(s.line + 1, end), raw: lines.slice(s.line + 1, end) };
  });
  for (const s of secs) {
    if (!body[s.name].raw.some((l) => l.trim() !== '')) errs.push(`section \`${s.name}\` is empty — write \`None.\` and why`);
  }

  // -- items --
  const items = {};
  for (const [sec, prefix] of Object.entries(ITEM_PREFIX)) {
    const b = body[sec];
    if (!b) continue;
    const list = parseItems(b.plain);
    for (const it of list) {
      if (it.prefix !== prefix) { errs.push(`\`${it.id}\` does not belong in \`${sec}\` (expected ${prefix}-n)`); continue; }
      if (items[it.id]) { errs.push(`duplicate ID \`${it.id}\``); continue; }
      items[it.id] = { ...it, section: sec };
    }
    const isNone = b.plain.some((l) => /^None\./.test(l.trim()));
    if (!list.length && ['User stories', 'Acceptance criteria (EARS)'].includes(sec)) {
      errs.push(`\`${sec}\` needs at least one ${prefix}-n item`);
    } else if (!list.length && !isNone && b.plain.some((l) => l.trim() !== '')) {
      errs.push(`\`${sec}\` has text but no \`- **${prefix}-n**\` items — use items, or write \`None.\``);
    }
  }
  const ids = Object.keys(items);
  const has = (id) => Object.prototype.hasOwnProperty.call(items, id);
  const refs = (t) => t.match(/\b(?:US|AC|EC|NFR|A|Q)-\d+\b/g) || [];
  const isIfAc = (id) => has(id) && /^IF\b/.test(acSentence(items[id].text, layout).sentence || '');

  for (const id of ids) {
    const it = items[id];
    const t = it.text;
    if (it.prefix === 'US') {
      if (!/\bAs an? .+, I want .+, so that .+/.test(t)) errs.push(`${id}: use "As a <user>, I want <goal>, so that <benefit>."`);
      const acs = refs(t.split('→')[1] || '').filter((x) => x.startsWith('AC-'));
      if (!acs.length) errs.push(`${id}: must point to at least one AC-n after \`→\``);
      for (const a of acs) if (!has(a)) errs.push(`${id}: points to unknown \`${a}\``);
    } else if (it.prefix === 'AC') {
      const { tag, sentence } = acSentence(t, layout);
      if (isCrossModule(rel, layout) && !tag) {
        errs.push(`${id}: a cross-module criterion needs a package tag (${layout.packages.length ? layout.packages.map((p) => `[${p}]`).join(' ') : '[<pkg>]'})`);
      }
      if (!/^(The|WHEN|WHILE|IF|WHERE)\b/.test(sentence)) errs.push(`${id}: must start with The / WHEN / WHILE / IF / WHERE (EARS)`);
      if (!/\bshall\b/.test(sentence)) errs.push(`${id}: must contain \`shall\``);
      if (/^IF\b/.test(sentence) && !/\bTHEN\b/.test(sentence)) errs.push(`${id}: IF needs THEN`);
      if (!VERIFY_RE.test(t)) errs.push(`${id}: must end with \`*Verify: unit | it | e2e | manual*\` (join several with " + ")`);
      const v = sentence.replace(/"[^"]*"|`[^`]*`/g, '').match(VAGUE_RE);
      if (v) errs.push(`${id}: vague word \`${v[1]}\` — give a number, a state or the exact text`);
    } else if (it.prefix === 'EC') {
      const acs = refs(t.split('→')[1] || '').filter((x) => x.startsWith('AC-'));
      if (!acs.length) errs.push(`${id}: must point to at least one AC-n after \`→\``);
      for (const a of acs) if (!has(a)) errs.push(`${id}: points to unknown \`${a}\``);
      if (acs.length && !acs.some(isIfAc)) errs.push(`${id}: must point to at least one IF … THEN criterion`);
    } else if (it.prefix === 'NFR') {
      if (!/\d/.test(t)) errs.push(`${id}: needs a number and unit`);
      if (!VERIFY_RE.test(t)) errs.push(`${id}: must end with \`*Verify: …*\``);
      const v = t.replace(/"[^"]*"|`[^`]*`/g, '').match(VAGUE_RE);
      if (v) errs.push(`${id}: vague word \`${v[1]}\``);
    } else if (it.prefix === 'A') {
      if (!/Risk if wrong:/.test(t)) errs.push(`${id}: add "Risk if wrong: <one line>."`);
    } else if (it.prefix === 'Q') {
      const m = t.match(/^\((blocking|non-blocking|planner)\)/);
      if (!m) errs.push(`${id}: start with (blocking), (non-blocking) or (planner)`);
      else if (m[1] === 'blocking' && status && status !== 'draft') errs.push(`${id}: a (blocking) question is not allowed in an ${status} spec`);
    }
  }

  // -- [NEEDS CLARIFICATION: Q-n] markers: an open question shown where the text depends on it --
  const qBody = body['Open questions'];
  const inQ = (i) => qBody && i >= qBody.start && i < qBody.start + qBody.plain.length;
  const isBlocking = (id) => has(id) && /^\(blocking\)/.test(items[id].text);
  const marked = new Set();
  plain.forEach((l, i) => {
    if (inQ(i)) return;
    for (const mk of l.replace(/`[^`]*`/g, '').matchAll(/\[NEEDS CLARIFICATION\b[^\]]*\]?/g)) {
      const q = mk[0].match(/^\[NEEDS CLARIFICATION: (Q-\d+)\]$/);
      if (!q) { errs.push(`line ${i + 1}: write the marker as \`[NEEDS CLARIFICATION: Q-n]\``); continue; }
      if (status && status !== 'draft') { errs.push(`line ${i + 1}: \`${mk[0]}\` is not allowed in an ${status} spec`); continue; }
      if (!has(q[1])) errs.push(`line ${i + 1}: \`${mk[0]}\` points to unknown \`${q[1]}\``);
      else if (!isBlocking(q[1])) errs.push(`line ${i + 1}: \`${q[1]}\` is not (blocking) — settle the text and remove the marker`);
      marked.add(q[1]);
    }
  });
  for (const id of ids) {
    if (isBlocking(id) && !marked.has(id)) errs.push(`${id}: a (blocking) question needs at least one \`[NEEDS CLARIFICATION: ${id}]\` marker where the spec text depends on it`);
  }

  // -- traceability --
  const tb = body['Traceability'];
  if (tb) {
    const rows = {};
    for (const l of tb.plain) {
      const m = l.match(/^\|\s*(AC-\d+)\s*\|(.*)\|\s*$/);
      if (!m) continue;
      const cells = m[2].split('|').map((c) => c.trim());
      if (rows[m[1]]) errs.push(`Traceability: duplicate row for \`${m[1]}\``);
      rows[m[1]] = cells;
      if (!has(m[1])) errs.push(`Traceability: unknown \`${m[1]}\``);
      for (const r of refs(cells.join(' '))) if (!has(r)) errs.push(`Traceability: \`${m[1]}\` row cites unknown \`${r}\``);
      const verify = cells[cells.length - 1] || '';
      if (!new RegExp(`^${VERIFY}$`).test(verify)) errs.push(`Traceability: \`${m[1]}\` needs a Verify value (unit | it | e2e | manual)`);
      else if (has(m[1])) {
        const vm = items[m[1]].text.match(VERIFY_RE);
        if (vm && vm[1] !== verify) errs.push(`Traceability: \`${m[1]}\` Verify \`${verify}\` differs from the criterion (\`${vm[1]}\`)`);
      }
    }
    for (const id of ids) if (id.startsWith('AC-') && !rows[id]) errs.push(`Traceability: no row for \`${id}\``);
  }
  return errs;
}

function acSentence(t, layout) {
  const m = t.match(/^\[([a-z0-9-]+)\]\s*(.*)$/s);
  const known = !layout.packages.length || (m && layout.packages.includes(m[1]));
  const tag = m && known ? m[1] : null;
  return { tag, sentence: (m ? m[2] : t).trim() };
}

// `- **XX-n** text` plus indented continuation lines.
function parseItems(plain) {
  const out = [];
  let cur = null;
  for (const l of plain) {
    const m = l.match(/^- \*\*([A-Z]+)-(\d+)\*\*\s*(.*)$/);
    if (m) { cur = { prefix: m[1], id: `${m[1]}-${m[2]}`, text: m[3] }; out.push(cur); continue; }
    if (cur && /^\s{2,}\S/.test(l)) { cur.text += ' ' + l.trim(); continue; }
    cur = null;
  }
  return out;
}

// Every spec file of the project: the cross-module folder plus each `.spec` folder found
// within four levels, skipping dependency and build folders.
function listSpecs(root, layout) {
  const out = [];
  const add = (rel) => {
    let names;
    try { names = fs.readdirSync(path.join(root, rel)); } catch { return; }
    for (const n of names) if (n.endsWith('.spec.md')) out.push(`${rel}/${n}`);
  };
  add(layout.specsDir);
  const walk = (rel, depth) => {
    if (depth > 4) return;
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel || '.'), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.name === '.spec') add(child);
      else walk(child, depth + 1);
    }
  };
  walk('', 0);
  return [...new Set(out)];
}

function projectRoot(json) {
  return process.env.CLAUDE_PROJECT_DIR || (typeof json?.cwd === 'string' ? json.cwd : process.cwd());
}

function relOf(root, file) {
  const abs = path.isAbsolute(file) ? file : path.resolve(root, file);
  return path.relative(root, abs).split(path.sep).join('/');
}

function inScope(rel, content, root) {
  return isSpecPath(rel, specLayout(root)) && /^Spec ID:/m.test(content);
}

function report(rel, errs) {
  return `spec-lint: ${rel} has ${errs.length} format error(s) (format of record: the spec-writing skill's template.md):\n` +
    errs.map((e) => `  - ${e}`).join('\n') + '\n';
}

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')); }
  catch { process.stderr.write('spec-lint: could not parse hook JSON — allowing (fail-open)\n'); process.exit(0); }
}

function hookPre() {
  const j = readStdin();
  const ti = j?.tool_input || {};
  const file = ti.file_path;
  if (typeof file !== 'string') process.exit(0);
  const root = projectRoot(j);
  const rel = relOf(root, file);
  let next;
  if (j.tool_name === 'Write') next = typeof ti.content === 'string' ? ti.content : '';
  else if (j.tool_name === 'Edit') {
    let cur;
    try { cur = fs.readFileSync(path.resolve(root, file), 'utf8'); } catch { process.exit(0); }
    if (typeof ti.old_string !== 'string' || typeof ti.new_string !== 'string' || !cur.includes(ti.old_string)) process.exit(0);
    next = ti.replace_all === true ? cur.split(ti.old_string).join(ti.new_string) : cur.replace(ti.old_string, () => ti.new_string);
  } else process.exit(0);
  if (!inScope(rel, next, root)) process.exit(0);
  const st = (next.match(/^Status: (\w+)/m) || [])[1];
  if (st !== 'approved' && st !== 'implemented') process.exit(0);
  const errs = lint(next, rel, root);
  if (!errs.length) process.exit(0);
  process.stderr.write('BLOCKED by spec-lint: a spec cannot become `' + st + '` with format errors — fix the draft first.\n' + report(rel, errs));
  process.exit(2);
}

function hookPost() {
  const j = readStdin();
  const file = j?.tool_input?.file_path;
  if (typeof file !== 'string') process.exit(0);
  const root = projectRoot(j);
  const rel = relOf(root, file);
  let txt;
  try { txt = fs.readFileSync(path.resolve(root, file), 'utf8'); } catch { process.exit(0); }
  if (!inScope(rel, txt, root)) process.exit(0);
  const errs = lint(txt, rel, root);
  if (!errs.length) process.exit(0);
  process.stderr.write(report(rel, errs) + 'Fix them with Edit while the spec is a draft.\n');
  process.exit(2);
}

function check(files) {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let bad = 0;
  for (const f of files) {
    const rel = relOf(root, f);
    const txt = fs.readFileSync(path.resolve(root, f), 'utf8');
    if (!inScope(rel, txt, root)) { process.stdout.write(`skip  ${rel} (not a spec path, or no Spec ID line)\n`); continue; }
    const errs = lint(txt, rel, root);
    if (errs.length) { bad++; process.stdout.write(report(rel, errs)); } else process.stdout.write(`ok    ${rel}\n`);
  }
  process.exit(bad ? 1 : 0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, ...rest] = process.argv.slice(2);
  try {
    if (mode === 'pre') hookPre();
    else if (mode === 'post') hookPost();
    else if (mode === 'check') check(rest);
    else { process.stderr.write('usage: spec-lint.mjs check <file>... | pre | post\n'); process.exit(mode ? 2 : 0); }
  } catch (e) {
    if (mode === 'check') throw e;
    process.stderr.write(`spec-lint: internal error (${e && e.message}) — allowing (fail-open)\n`);
    process.exit(0);
  }
}
