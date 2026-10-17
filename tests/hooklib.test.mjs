// tools/hooklib: config loading and the shell tokenizer (plan B2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, DEFAULTS } from '../tools/hooklib/config.mjs';
import { splitCommands, parseCommands } from '../tools/hooklib/shell-words.mjs';

function project(configText) {
  const dir = mkdtempSync(join(tmpdir(), 'sdd-hooklib-'));
  if (configText !== undefined) {
    mkdirSync(join(dir, '.sdd'));
    writeFileSync(join(dir, '.sdd', 'config.json'), configText);
  }
  return dir;
}

test('loadConfig: no file → defaults, no errors', () => {
  const { config, errors } = loadConfig(project());
  assert.deepEqual(errors, []);
  assert.deepEqual(config, DEFAULTS);
  assert.deepEqual(config, {
    context: [], specs: 'specs/', plans: 'docs/plans/', runs: '.sdd/runs/', checks: {}, routing: null,
    agents: [], skills: {}, checksDir: '.sdd/checks/', retros: 'docs/retros/',
  });
});

test('loadConfig: a key overrides its default, the rest stay', () => {
  const { config, errors } = loadConfig(project('{"specs":"docs/specs/"}'));
  assert.deepEqual(errors, []);
  assert.equal(config.specs, 'docs/specs/');
  assert.equal(config.plans, 'docs/plans/');
  assert.deepEqual(config.checks, {});
});

test('loadConfig: invalid JSON → defaults plus one error', () => {
  const { config, errors } = loadConfig(project('{bad'));
  assert.deepEqual(config, DEFAULTS);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /config\.json/);
});

test('loadConfig: a non-object document → defaults plus one error', () => {
  const { config, errors } = loadConfig(project('[1,2]'));
  assert.deepEqual(config, DEFAULTS);
  assert.equal(errors.length, 1);
});

test('loadConfig: the returned config is a copy, not the defaults object', () => {
  const { config } = loadConfig(project());
  config.context.push('x');
  assert.deepEqual(DEFAULTS.context, []);
});

test('splitCommands: a chain splits into simple commands', () => {
  assert.deepEqual(splitCommands('ls && git push'), [['ls'], ['git', 'push']]);
});

test('splitCommands: quoted words stay one token, unquoted', () => {
  assert.deepEqual(splitCommands('echo "git push"'), [['echo', 'git push']]);
});

test('splitCommands: a heredoc body is data, not a command', () => {
  const cmds = splitCommands('cat <<EOF\ngit push\nEOF');
  assert.ok(!cmds.some((c) => c.includes('git') && c.includes('push')), JSON.stringify(cmds));
  assert.equal(cmds[0][0], 'cat');
});

test('splitCommands: a command in a subshell is found', () => {
  assert.ok(splitCommands('(git push)').some((c) => c.join(' ') === 'git push'));
});

test('splitCommands: leading assignments are dropped', () => {
  assert.deepEqual(splitCommands('FOO=1 git commit -m x'), [['git', 'commit', '-m', 'x']]);
});

test('splitCommands: separators ; | & || newline and comments', () => {
  assert.deepEqual(splitCommands('echo x; git commit -m y'), [['echo', 'x'], ['git', 'commit', '-m', 'y']]);
  assert.deepEqual(splitCommands('a | b || c & d\ne'), [['a'], ['b'], ['c'], ['d'], ['e']]);
  assert.deepEqual(splitCommands('# git commit later'), []);
  assert.deepEqual(splitCommands('ls # then git push\npwd'), [['ls'], ['pwd']]);
});

test('splitCommands: line continuations are joined', () => {
  assert.deepEqual(splitCommands('git \\\n  push'), [['git', 'push']]);
});

test('splitCommands: command substitution is a command of its own', () => {
  const cmds = splitCommands('echo "$(git push)"');
  assert.ok(cmds.some((c) => c.join(' ') === 'git push'), JSON.stringify(cmds));
  assert.ok(splitCommands('echo `git push`').some((c) => c.join(' ') === 'git push'));
});

test('splitCommands: an unquoted heredoc expands substitutions, a quoted one does not', () => {
  assert.ok(splitCommands('cat <<EOF\n$(git push)\nEOF').some((c) => c.join(' ') === 'git push'));
  assert.ok(!splitCommands("cat <<'EOF'\n$(git push)\nEOF").some((c) => c.join(' ') === 'git push'));
});

test('splitCommands: a heredoc keeps the rest of its line', () => {
  const [cmd] = parseCommands('cat <<EOF > out.txt\nhello\nEOF');
  assert.deepEqual(cmd.redirs.map((r) => [r.op, r.target]), [['<<', 'EOF'], ['>', 'out.txt']]);
});

test('parseCommands: redirections are separated from words', () => {
  const [cmd] = parseCommands('echo hi>f.txt 2>&1');
  assert.deepEqual(cmd.words.map((w) => w.v), ['echo', 'hi']);
  assert.deepEqual(cmd.redirs.map((r) => [r.op, r.target]), [['>', 'f.txt'], ['2>&1', null]]);
});

test('parseCommands: a quoted operator is a word, not a redirection', () => {
  const [cmd] = parseCommands('echo ">" "a|b"');
  assert.deepEqual(cmd.words.map((w) => w.v), ['echo', '>', 'a|b']);
  assert.deepEqual(cmd.redirs, []);
});

test('parseCommands: assignments, expansions and globs are flagged', () => {
  const [cmd] = parseCommands('PAGER=x git log $REF src/*.ts');
  assert.deepEqual(cmd.assigns, ['PAGER=x']);
  assert.equal(cmd.words[2].expand, true);
  assert.equal(cmd.words[3].glob, true);
  assert.equal(cmd.words[0].expand, false);
});
