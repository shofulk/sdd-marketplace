// sdd-engineering/hooks/push-guard.mjs — no `git push` to the default branch from any Claude Code
// session, main thread or subagent (1.1.0, spec §3.8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'push-guard.mjs');
const MARKER = /^SDD-PUSH-BLOCKED: /m;

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

// A clone of a bare remote with `main` and `origin/HEAD`, checked out on `branch`.
function repo({ branch = 'main', defaultBranch = 'main' } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'sdd-push-guard-')));
  const remote = join(root, 'remote.git');
  const work = join(root, 'repo');
  git(root, 'init', '-q', '--bare', `--initial-branch=${defaultBranch}`, remote);
  mkdirSync(work);
  git(work, 'init', '-q', `--initial-branch=${defaultBranch}`);
  git(work, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'init');
  git(work, 'remote', 'add', 'origin', remote);
  git(work, 'push', '-q', 'origin', defaultBranch);
  git(work, 'fetch', '-q', 'origin');
  git(work, 'remote', 'set-head', 'origin', defaultBranch);
  if (branch !== defaultBranch) git(work, 'switch', '-q', '-c', branch);
  return { root, work };
}

function run(cwd, command, { tool = 'Bash', agent } = {}) {
  const payload = { hook_event_name: 'PreToolUse', tool_name: tool, cwd, tool_input: { command } };
  if (agent) payload.agent_type = agent;
  return spawnSync(process.execPath, [GUARD], {
    input: typeof command === 'string' ? JSON.stringify(payload) : command.raw,
    env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
  });
}

const blocked = (r, why) => {
  assert.equal(r.status, 2, `expected a block (${why}); stderr: ${r.stderr}`);
  assert.match(r.stderr, MARKER);
};
const passed = (r, why) => assert.equal(r.status, 0, `expected a pass (${why}); stderr: ${r.stderr}`);

// The four cases the spec names.
test('a push to main is blocked', () => {
  blocked(run(repo().work, 'git push origin main'), 'origin main');
});

test('--no-verify changes nothing', () => {
  blocked(run(repo().work, 'git push --no-verify origin main'), '--no-verify');
});

test('HEAD:main from a feature branch is blocked', () => {
  blocked(run(repo({ branch: 'feat/x' }).work, 'git push origin HEAD:main'), 'HEAD:main');
});

test('a push of a feature branch passes', () => {
  const { work } = repo({ branch: 'feat/x' });
  passed(run(work, 'git push origin feat/x'), 'feat/x');
  passed(run(work, 'git push -u origin HEAD'), 'HEAD on feat/x');
  passed(run(work, 'git push'), 'no refspec on feat/x');
});

test('every refspec spelling of the default branch is blocked', () => {
  const { work } = repo({ branch: 'feat/x' });
  for (const spec of ['+main', 'refs/heads/main', 'feat/x:main', 'feat/x:refs/heads/main', '+HEAD:main', ':main', 'refs/heads/*:refs/heads/*']) {
    blocked(run(work, `git push origin ${spec}`), spec);
  }
  blocked(run(work, 'git push origin feat/x main'), 'a second refspec');
  blocked(run(work, 'git push --delete origin main'), '--delete');
  blocked(run(work, 'git push --force-with-lease=main origin main'), 'force with lease');
});

test('--all, --branches and --mirror are blocked', () => {
  const { work } = repo({ branch: 'feat/x' });
  for (const flag of ['--all', '--branches', '--mirror']) blocked(run(work, `git push ${flag} origin`), flag);
});

test('no refspec while on the default branch is blocked', () => {
  const { work } = repo();
  blocked(run(work, 'git push'), 'bare git push on main');
  blocked(run(work, 'git push origin'), 'remote only on main');
  blocked(run(work, 'git push origin HEAD'), 'HEAD on main');
  blocked(run(work, 'git push -u origin HEAD'), '-u HEAD on main');
  blocked(run(work, 'git push -o ci.skip origin'), 'an option value is not the remote');
});

test('git -C reads the current branch of the named directory', () => {
  const { root } = repo();
  blocked(run(root, 'git -C repo push'), 'no refspec, repo on main');
});

test('the default branch comes from refs/remotes/<remote>/HEAD', () => {
  const { work } = repo({ branch: 'feat/x', defaultBranch: 'trunk' });
  blocked(run(work, 'git push origin trunk'), 'trunk is the default');
  passed(run(work, 'git push origin main'), 'main is not the default here');
});

test('without refs/remotes/<remote>/HEAD the default branch is main', () => {
  const { work } = repo({ branch: 'feat/x' });
  git(work, 'remote', 'set-head', 'origin', '-d');
  blocked(run(work, 'git push origin main'), 'fallback main');
  passed(run(work, 'git push origin feat/x'), 'feature branch');
});

test('tags and options with values are not refspecs of main', () => {
  const { work } = repo({ branch: 'feat/x' });
  passed(run(work, 'git push --tags'), '--tags');
  passed(run(work, 'git push origin v1.0.0'), 'a tag name');
  passed(run(work, 'git push -o ci.skip origin feat/x'), '-o value');
  passed(run(work, 'git push --repo origin feat/x'), '--repo value');
});

test('the main thread and subagents are judged alike', () => {
  blocked(run(repo().work, 'git push origin main', { agent: 'sdd-engineering:implementer' }), 'implementer');
  blocked(run(repo().work, 'git push origin main', { agent: 'some-plugin:any-agent' }), 'another agent');
});

test('a push hidden behind a wrapper, a shell or a chain is found', () => {
  const { root, work } = repo();
  for (const cmd of [
    'git add -A && git commit -m x && git push origin main',
    'env GIT_TRACE=0 git push origin main',
    'command git push origin main',
    "bash -c 'git push origin main'",
    'eval git push origin main',
    'git -C repo push origin main',
    'cd repo && git push',
    'git --no-pager push origin main',
  ]) {
    blocked(run(cmd.includes('repo') ? root : work, cmd), cmd);
  }
});

test('quoted text and other commands are not pushes', () => {
  const { work } = repo();
  passed(run(work, 'echo "git push origin main"'), 'echo');
  passed(run(work, 'git status && git log --oneline -1'), 'read-only git');
  passed(run(work, 'git ls-remote origin main'), 'ls-remote');
  passed(run(work, 'git commit -m "do not git push origin main"'), 'a commit message');
});

test('a refspec the guard cannot read is blocked', () => {
  blocked(run(repo({ branch: 'feat/x' }).work, 'git push origin "$BRANCH"'), 'an expanded refspec');
});

test('other tools and unreadable input pass', () => {
  const { work } = repo();
  passed(run(work, 'git push origin main', { tool: 'Write' }), 'Write');
  const bad = run(work, { raw: 'not json' });
  passed(bad, 'not json');
  assert.match(bad.stderr, /push-guard: could not read the hook input/);
});
