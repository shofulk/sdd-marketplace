// A Bash command-line tokenizer for PreToolUse guards: it finds every simple command a string would
// run, so a guard judges real invocations and treats quoted text and heredoc bodies as data.
// Canonical copy: tools/hooklib/ in the sdd-marketplace repository; plugins carry synced copies
// in hooks/lib/ (npm run sync-hooklib). Edit the canonical copy only.
//
// Adapted from the inline matcher of pr-gate.sh (stripHeredocs, segments, tokens); the upstream
// repository, copyright and MIT license are in the plugin's NOTICE. Extended here: heredocs keep the rest
// of their line, command substitution ($(...), backticks, also inside double quotes and unquoted
// heredoc bodies) yields commands of its own, redirections are separate from words, and each word
// records whether it was quoted, expanded ($), escaped (\) or globbed (* ? [).
//
// Not a full shell parser: brace groups and `{`/`}` split commands, `case` patterns are not
// modelled. Guards built on it should allow-list (readonly) or deny-list (implementer) on top.

const SEPARATORS = ';|&(){}';
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;

/**
 * Every simple command in `cmd`, as `{ words, assigns, redirs, tokens, nested }`:
 * - words: `{ v, quoted, firstQuoted, expand, glob, escaped, subst }` — the command and its arguments;
 * - assigns: leading `NAME=value` strings;
 * - redirs: `{ op, target }` in order (`target` null for an fd duplication such as `2>&1`);
 * - tokens: words and operators in order, assignments excluded (what splitCommands returns);
 * - nested: true for a command found inside a command substitution or heredoc expansion.
 */
export function parseCommands(cmd) {
  const out = [];
  parseInto(String(cmd ?? ''), out, false, 0);
  return out;
}

/** Simple commands as token arrays; heredoc bodies removed, assignments dropped. */
export function splitCommands(cmd) {
  return parseCommands(cmd).map((c) => c.tokens).filter((t) => t.length);
}

function parseInto(s, out, nested, depth) {
  if (depth > 8) return;
  let i = 0;
  let cur = null;
  let tokens = [];
  let pending = [];

  const word = () => {
    if (!cur) cur = { v: '', quoted: false, firstQuoted: null, expand: false, glob: false, escaped: false, subst: false };
    return cur;
  };
  const first = (q) => { if (cur.firstQuoted === null) cur.firstQuoted = q; };
  const flush = () => { if (cur) { tokens.push(cur); cur = null; } };
  const end = () => {
    flush();
    if (tokens.length) out.push(build(tokens, nested));
    tokens = [];
  };
  const sub = (inner) => parseInto(inner, out, true, depth + 1);

  while (i < s.length) {
    const c = s[i];

    if (c === '\\') {
      if (s[i + 1] === '\n') { i += 2; continue; }
      word(); first(true);
      cur.v += s[i + 1] ?? '';
      cur.escaped = true;
      i += 2;
      continue;
    }
    if (c === "'") {
      word(); first(true);
      let j = s.indexOf("'", i + 1);
      if (j < 0) j = s.length;
      cur.v += s.slice(i + 1, j);
      cur.quoted = true;
      i = j + 1;
      continue;
    }
    if (c === '"') {
      word(); first(true);
      cur.quoted = true;
      i = readDouble(s, i + 1, cur, sub);
      continue;
    }
    if (c === '$') {
      word(); first(false);
      i = readDollar(s, i, cur, sub);
      continue;
    }
    if (c === '`') {
      word(); first(false);
      const j = closingBacktick(s, i + 1);
      sub(s.slice(i + 1, j));
      cur.v += s.slice(i, j + 1);
      cur.subst = cur.expand = true;
      i = j + 1;
      continue;
    }
    if (c === '#' && !cur) {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    if (c === '\n') {
      end();
      i++;
      for (const h of pending) {
        const r = readHeredocBody(s, i, h);
        if (!h.quoted) scanSubstitutions(r.body, sub);
        i = r.next;
      }
      pending = [];
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') { flush(); i++; continue; }

    if (c === '>' || c === '<' || (c === '&' && s[i + 1] === '>')) {
      let fd = '';
      if (cur && c !== '&' && /^\d+$/.test(cur.v) && !cur.quoted && !cur.escaped && !cur.expand) { fd = cur.v; cur = null; }
      else flush();
      const op = readOperator(s, i);
      i += op.length;
      if (op === '>&' || op === '<&') {
        const m = /^(\d+|-)/.exec(s.slice(i));
        if (m) { tokens.push({ op: fd + op + m[1], dup: true }); i += m[1].length; continue; }
      }
      if (op === '<<' || op === '<<-') {
        while (s[i] === ' ' || s[i] === '\t') i++;
        const d = readDelimiter(s, i);
        i = d.next;
        tokens.push({ op: fd + op, heredoc: true });
        tokens.push({ v: d.delim, quoted: d.quoted, firstQuoted: d.quoted, expand: false, glob: false, escaped: false, subst: false });
        pending.push({ delim: d.delim, dash: op === '<<-', quoted: d.quoted });
        continue;
      }
      tokens.push({ op: fd + op });
      continue;
    }

    if (SEPARATORS.includes(c)) {
      end();
      const two = s.slice(i, i + 2);
      i += two === '&&' || two === '||' || two === '|&' || two === ';;' ? 2 : 1;
      continue;
    }

    word(); first(false);
    if (c === '*' || c === '?' || c === '[') cur.glob = true;
    cur.v += c;
    i++;
  }
  end();
}

function build(tokens, nested) {
  const assigns = [];
  const words = [];
  const redirs = [];
  const kept = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.op !== undefined) {
      kept.push(t.op);
      if (t.dup) { redirs.push({ op: t.op, target: null }); continue; }
      const next = tokens[k + 1];
      if (next && next.op === undefined) {
        redirs.push({ op: t.op, target: next.v, targetWord: next });
        kept.push(next.v);
        k++;
      } else {
        redirs.push({ op: t.op, target: '' });
      }
      continue;
    }
    if (!words.length && !t.firstQuoted && ASSIGNMENT.test(t.v)) { assigns.push(t.v); continue; }
    words.push(t);
    kept.push(t.v);
  }
  return { words, assigns, redirs, tokens: kept, nested };
}

function readOperator(s, i) {
  const rest = s.slice(i, i + 3);
  for (const op of ['&>>', '<<<', '<<-', '&>', '>>', '>&', '>|', '<<', '<&', '<>', '>', '<']) {
    if (rest.startsWith(op)) return op;
  }
  return s[i];
}

function readDouble(s, j, cur, sub) {
  while (j < s.length) {
    const ch = s[j];
    if (ch === '"') return j + 1;
    if (ch === '\\') {
      const nx = s[j + 1];
      cur.escaped = true;
      if (nx === '\n') { j += 2; continue; }
      if (nx !== undefined && '$`"\\'.includes(nx)) { cur.v += nx; j += 2; continue; }
      cur.v += '\\';
      j++;
      continue;
    }
    if (ch === '$') { j = readDollar(s, j, cur, sub); continue; }
    if (ch === '`') {
      const k = closingBacktick(s, j + 1);
      sub(s.slice(j + 1, k));
      cur.v += s.slice(j, k + 1);
      cur.subst = cur.expand = true;
      j = k + 1;
      continue;
    }
    cur.v += ch;
    j++;
  }
  return j;
}

function readDollar(s, i, cur, sub) {
  const nx = s[i + 1];
  cur.expand = true;
  if (nx === '(') {
    const close = matching(s, i + 1, '(', ')');
    sub(s.slice(i + 2, close));
    cur.v += s.slice(i, close + 1);
    cur.subst = true;
    return close + 1;
  }
  if (nx === '{') {
    const close = matching(s, i + 1, '{', '}');
    cur.v += s.slice(i, close + 1);
    return close + 1;
  }
  if (nx === "'") {
    let j = i + 2;
    while (j < s.length && s[j] !== "'") j += s[j] === '\\' ? 2 : 1;
    cur.v += s.slice(i + 2, j);
    cur.quoted = true;
    return j + 1;
  }
  cur.v += '$';
  return i + 1;
}

// Index of the bracket that closes the one at `open`, honouring quotes and escapes; s.length if none.
function matching(s, open, o, c) {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    const ch = s[k];
    if (ch === '\\') { k++; continue; }
    if (ch === "'") { const e = s.indexOf("'", k + 1); k = e < 0 ? s.length : e; continue; }
    if (ch === '"') {
      k++;
      while (k < s.length && s[k] !== '"') k += s[k] === '\\' ? 2 : 1;
      continue;
    }
    if (ch === o) depth++;
    else if (ch === c && --depth === 0) return k;
  }
  return s.length;
}

function closingBacktick(s, j) {
  while (j < s.length && s[j] !== '`') j += s[j] === '\\' ? 2 : 1;
  return Math.min(j, s.length);
}

function readDelimiter(s, i) {
  let delim = '';
  let quoted = false;
  while (i < s.length && !/[\s;|&()<>]/.test(s[i])) {
    const ch = s[i];
    if (ch === "'" || ch === '"') {
      quoted = true;
      const e = s.indexOf(ch, i + 1);
      const stop = e < 0 ? s.length : e;
      delim += s.slice(i + 1, stop);
      i = stop + 1;
      continue;
    }
    if (ch === '\\') { quoted = true; delim += s[i + 1] ?? ''; i += 2; continue; }
    delim += ch;
    i++;
  }
  return { delim, quoted, next: i };
}

function readHeredocBody(s, i, h) {
  const start = i;
  while (i <= s.length) {
    const nl = s.indexOf('\n', i);
    const lineEnd = nl < 0 ? s.length : nl;
    const line = s.slice(i, lineEnd).replace(/\r$/, '');
    if ((h.dash ? line.replace(/^\t+/, '') : line) === h.delim) {
      return { body: s.slice(start, i), next: nl < 0 ? s.length : nl + 1 };
    }
    if (nl < 0) break;
    i = nl + 1;
  }
  return { body: s.slice(start), next: s.length };
}

// An unquoted heredoc body still runs $(...) and backticks; quotes in it are literal text.
function scanSubstitutions(body, sub) {
  for (let k = 0; k < body.length; k++) {
    const ch = body[k];
    if (ch === '\\') { k++; continue; }
    if (ch === '$' && body[k + 1] === '(') {
      const close = matching(body, k + 1, '(', ')');
      sub(body.slice(k + 2, close));
      k = close;
    } else if (ch === '`') {
      const close = closingBacktick(body, k + 1);
      sub(body.slice(k + 1, close));
      k = close;
    }
  }
}
