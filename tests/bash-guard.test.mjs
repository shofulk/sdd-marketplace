// tools/hooklib/bash-guard.mjs — the per-agent Bash guard (plan B2, spec §3.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'hooklib', 'bash-guard.mjs');

function fixture(config) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'sdd-guard-')));
  const project = join(base, 'project');
  const pluginRoot = join(base, 'plugin');
  mkdirSync(join(project, '.sdd'), { recursive: true });
  mkdirSync(join(pluginRoot, 'scripts'), { recursive: true });
  writeFileSync(join(pluginRoot, 'scripts', 'checks.mjs'), '');
  mkdirSync(join(pluginRoot, 'hooks'), { recursive: true });
  writeFileSync(join(pluginRoot, 'hooks', 'spec-lint.mjs'), '');
  if (config !== undefined) writeFileSync(join(project, '.sdd', 'config.json'), config);
  return { project, pluginRoot };
}

function guard({ profile, agents, agentType, command, config, stdin, cwd }) {
  const { project, pluginRoot } = fixture(config);
  const payload = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: command?.replaceAll('<CLAUDE_PLUGIN_ROOT>', pluginRoot) }, cwd: cwd ?? project };
  if (agentType !== undefined) payload.agent_type = agentType;
  return spawnSync(process.execPath, [GUARD, profile, '--agents', agents], {
    input: stdin ?? JSON.stringify(payload),
    env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: project, CLAUDE_PLUGIN_ROOT: pluginRoot },
    encoding: 'utf8',
  });
}

const CHECKS = '{"checks":{"app":{"test":"npm test"}}}';

// The plan's table: profile, agents, agent_type, command, config.checks, exit.
const TABLE = [
  ['readonly', 'x:a', 'x:a', 'git status', undefined, 0],
  ['readonly', 'x:a', 'x:a', 'rg foo src', undefined, 0],
  ['readonly', 'x:a', 'x:a', 'rm -rf build', undefined, 2],
  ['readonly', 'x:a', 'x:a', 'echo hi > f.txt', undefined, 2],
  ['readonly', 'x:a', 'x:a', 'ls && rm f', undefined, 2],
  ['readonly', 'x:a', 'x:b', 'rm -rf build', undefined, 0],
  ['readonly', 'x:a', undefined, 'rm -rf build', undefined, 0],
  ['checks', 'x:a', 'x:a', 'npm test', CHECKS, 0],
  ['checks', 'x:a', 'x:a', 'npm test', undefined, 2],
  ['checks', 'x:a', 'x:a', 'node <CLAUDE_PLUGIN_ROOT>/scripts/checks.mjs status f', undefined, 0],
  // E2E-1: a read-only agent re-checks a spec with the plugin's own spec-lint, `check` mode only.
  ['readonly', 'x:a', 'x:a', 'node <CLAUDE_PLUGIN_ROOT>/hooks/spec-lint.mjs check specs/x.spec.md', undefined, 0],
  ['checks', 'x:a', 'x:a', 'node <CLAUDE_PLUGIN_ROOT>/hooks/spec-lint.mjs check specs/x.spec.md', undefined, 0],
  ['readonly', 'x:a', 'x:a', 'node <CLAUDE_PLUGIN_ROOT>/hooks/spec-lint.mjs pre', undefined, 2],
  ['readonly', 'x:a', 'x:a', 'node /tmp/elsewhere/spec-lint.mjs check specs/x.spec.md', undefined, 2],
  ['implementer', 'x:i', 'x:i', 'git commit -m x', undefined, 2],
  ['implementer', 'x:i', 'x:i', 'ls && git push', undefined, 2],
  ['implementer', 'x:i', 'x:i', 'echo "git push"', undefined, 0],
  ['implementer', 'x:i', 'x:i', 'npm test', undefined, 0],
  ['implementer', 'x:i', 'x:i', 'docker ps', undefined, 2],
  ['implementer', 'x:i', 'x:i', 'psql -c 1', undefined, 2],
];

for (const [profile, agents, agentType, command, config, exit] of TABLE) {
  test(`${profile} [${agentType ?? 'main thread'}] ${command} → ${exit}`, () => {
    const r = guard({ profile, agents, agentType, command, config });
    assert.equal(r.status, exit, r.stderr);
    if (exit === 2) assert.match(r.stderr, /bash-guard/);
  });
}

// Review focus: chains, subshells, comments, quotes, heredocs; two guards; bad input.
const MORE = [
  ['readonly', 'git diff --stat 2>&1 | head -50', 0],
  ['readonly', 'ls >/dev/null 2>&1', 0],
  ['readonly', "find . -name '*.md'", 0],
  ['readonly', 'find . -name x -delete', 2],
  ['readonly', 'find . -exec rm {} ;', 2],
  ['readonly', 'cat f | tee out', 2],
  ['readonly', 'echo x >> log', 2],
  ['readonly', 'sed -i s/a/b/ f', 2],
  ['readonly', 'sed -n 1,20p f', 0],
  ['readonly', 'git checkout -- f', 2],
  ['readonly', 'git diff --output=f', 2],
  ['readonly', 'git -C other status', 2],
  ['readonly', 'bash -c "rm f"', 2],
  ['readonly', 'bash -c "git status"', 0],
  ['readonly', 'echo $(rm f)', 2],
  ['readonly', 'GIT_EXTERNAL_DIFF=x git diff', 2],
  ['readonly', 'cd sub && ls', 2],
  ['readonly', 'ls src/*.ts', 2],
  ['readonly', '(rm f)', 2],
  ['readonly', 'cat <<EOF > out.txt\nhi\nEOF', 2],
  ['readonly', "cat <<'EOF'\nrm -rf /\nEOF", 0],
  ['readonly', 'echo "then rm -rf build"', 0],
  ['readonly', '/bin/rm f', 2],
  ['readonly', 'npm test', 2],
  ['implementer', '(git push)', 2],
  ['implementer', 'echo x; git commit -m y', 2],
  ['implementer', 'bash -c "git push origin main"', 2],
  ['implementer', 'git -C pkg push', 2],
  ['implementer', 'GIT_DIR=x git push', 2],
  ['implementer', 'echo "$(git push)"', 2],
  ['implementer', 'sudo docker ps', 2],
  ['implementer', '/usr/bin/git push', 2],
  ['implementer', 'git reset --hard HEAD~1', 2],
  ['implementer', 'git reset HEAD f', 0],
  ['implementer', 'git clean -fdx', 2],
  ['implementer', 'gh pr create --fill', 2],
  ['implementer', 'npm run db:migrate', 2],
  ['implementer', 'npx prisma migrate deploy', 2],
  ['implementer', 'git status && git diff', 0],
  ['implementer', 'git log --grep commit', 0],
  ['implementer', '# git commit later', 0],
  ['implementer', "cat <<'EOF'\ngit push\nEOF", 0],
  ['implementer', 'echo hi > notes.txt', 0],
  ['implementer', 'cat <<EOF | bash\ngit push\nEOF', 2],
  ['implementer', 'timeout 60 git push', 2],
  ['implementer', 'npx drizzle-kit push', 2],
  ['readonly', 'cat < /dev/tcp/example.com/80', 2],
  ['readonly', 'CI=1 git status', 0],
];

for (const [profile, command, exit] of MORE) {
  test(`${profile} ${JSON.stringify(command)} → ${exit}`, () => {
    const r = guard({ profile, agents: 'x:a', agentType: 'x:a', command });
    assert.equal(r.status, exit, r.stderr);
  });
}

test('checks: a configured command with a safe redirection and a readonly pipe passes', () => {
  assert.equal(guard({ profile: 'checks', agents: 'x:a', agentType: 'x:a', command: 'npm test 2>&1 | tail -20', config: CHECKS }).status, 0);
});

test('checks: a configured command run from another directory is blocked', () => {
  const r = guard({ profile: 'checks', agents: 'x:a', agentType: 'x:a', command: 'npm test', config: CHECKS, cwd: '/' });
  assert.equal(r.status, 2);
});

test('checks: another script in the plugin root is not the checks script', () => {
  const r = guard({ profile: 'checks', agents: 'x:a', agentType: 'x:a', command: 'node <CLAUDE_PLUGIN_ROOT>/scripts/other.mjs run' });
  assert.equal(r.status, 2);
});

test('several agents in one --agents list are each guarded', () => {
  for (const agentType of ['p:one', 'p:two']) {
    assert.equal(guard({ profile: 'readonly', agents: 'p:one,p:two', agentType, command: 'rm f' }).status, 2);
  }
  assert.equal(guard({ profile: 'readonly', agents: 'p:one,p:two', agentType: 'p:three', command: 'rm f' }).status, 0);
});

test('empty stdin → exit 0 with one stderr line', () => {
  const r = guard({ profile: 'readonly', agents: 'x:a', stdin: '' });
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim().split('\n').length, 1);
});

test('malformed stdin → exit 0 with one stderr line', () => {
  const r = guard({ profile: 'implementer', agents: 'x:a', stdin: '{"tool_name":' });
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim().split('\n').length, 1);
});

test('invalid .sdd/config.json with the checks profile still decides', () => {
  const r = guard({ profile: 'checks', agents: 'x:a', agentType: 'x:a', command: 'npm test', config: '{bad' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /config\.json/);
});

test('a non-Bash tool payload is allowed', () => {
  const r = guard({ profile: 'readonly', agents: 'x:a', stdin: JSON.stringify({ tool_name: 'Read', agent_type: 'x:a', tool_input: {} }) });
  assert.equal(r.status, 0);
});

test('an unknown profile fails open with one stderr line', () => {
  const r = guard({ profile: 'nonsense', agents: 'x:a', agentType: 'x:a', command: 'rm f' });
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim().split('\n').length, 1);
});
