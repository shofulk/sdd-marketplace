// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCatalog, excerpt, normalizeList } from '../scripts/build-catalog.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'repo');
const script = join(here, '..', 'scripts', 'build-catalog.mjs');
const now = new Date('2026-10-17T18:30:00.000Z');

const temps: string[] = [];
function copyFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'catalog-fixture-'));
  temps.push(dir);
  cpSync(fixture, dir, { recursive: true });
  return dir;
}
function editJson(file: string, edit: (data: any) => void) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  edit(data);
  writeFileSync(file, JSON.stringify(data, null, 2));
}
function build(root = fixture, extra: object = {}) {
  vi.stubEnv('GITHUB_REPOSITORY', '');
  vi.stubEnv('GITHUB_SHA', '');
  return buildCatalog({ root, sha: 'abc1234', now, ...extra });
}
const plugin = (c: ReturnType<typeof build>, name: string) => c.plugins.find((p) => p.name === name)!;
const comp = (c: ReturnType<typeof build>, p: string, name: string) => plugin(c, p).components.find((x) => x.name === name)!;

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('buildCatalog on the fixture repository', () => {
  it('reads the marketplace and the build stamp', () => {
    const c = build();
    expect(c.marketplace).toEqual({
      name: 'sdd', owner: 'acme', description: 'Fixture marketplace for the catalog build tests.', repo: 'acme/sdd-marketplace',
    });
    expect(c.build).toEqual({ sha: 'abc1234', builtAt: '2026-10-17T18:30:00.000Z' });
  });

  it('takes the repo from GITHUB_REPOSITORY and the sha from GITHUB_SHA when set', () => {
    vi.stubEnv('GITHUB_REPOSITORY', 'someone/fork');
    vi.stubEnv('GITHUB_SHA', 'feedface');
    const c = buildCatalog({ root: fixture, now });
    expect(c.marketplace.repo).toBe('someone/fork');
    expect(c.build.sha).toBe('feedface');
  });

  it('lists both plugins with version, displayName, keywords and dependencies', () => {
    const c = build();
    expect(c.plugins.map((p) => p.name)).toEqual(['sdd-engineering', 'research-tools']);
    const sdd = plugin(c, 'sdd-engineering');
    expect(sdd).toMatchObject({
      displayName: 'SDD Engineering', version: '1.1.0', author: 'acme', keywords: ['sdd', 'workflow'],
      dependencies: [{ name: 'research-tools', range: '^1.0.0' }], path: 'plugins/sdd-engineering',
      readme: '# SDD Engineering\n\nTakes a feature from request to a verified change.\n',
    });
    expect(plugin(c, 'research-tools')).toMatchObject({
      displayName: 'Research Tools', version: '1.0.0', keywords: ['research', 'read-only'], dependencies: [],
    });
  });

  it('takes stableVersion from the stable file ref, null when not pinned', () => {
    const c = build();
    expect(plugin(c, 'sdd-engineering').stableVersion).toBe('1.0.0');
    expect(plugin(c, 'research-tools').stableVersion).toBeNull();
  });

  it('normalizes tools from a YAML list and from an inline array', () => {
    const c = build();
    expect(comp(c, 'sdd-engineering', 'implementer').tools).toEqual(['Read', 'Grep']);
    expect(comp(c, 'research-tools', 'researcher').tools).toEqual(['Read', 'Grep']);
    expect(normalizeList('Read, Grep')).toEqual(['Read', 'Grep']);
    expect(normalizeList(undefined)).toEqual([]);
  });

  it('builds invocations for skills and agents', () => {
    const c = build();
    expect(comp(c, 'sdd-engineering', 'run-plan')).toMatchObject({ kind: 'skill', invocation: '/sdd-engineering:run-plan' });
    expect(comp(c, 'sdd-engineering', 'spec-writing')).toMatchObject({ kind: 'skill', invocation: null });
    expect(comp(c, 'sdd-engineering', 'implementer')).toMatchObject({
      kind: 'agent', invocation: '@agent-sdd-engineering:implementer', model: 'sonnet', skills: ['onion-architecture'],
      path: 'plugins/sdd-engineering/agents/implementer.md',
    });
    expect(comp(c, 'research-tools', 'researcher')).toMatchObject({ invocation: '@agent-research-tools:researcher', model: null });
  });

  it('makes one hook component per distinct script in hooks.json', () => {
    const c = build();
    const hooks = plugin(c, 'sdd-engineering').components.filter((x) => x.kind === 'hook');
    expect(hooks.map((h) => h.name).sort()).toEqual(['bash-guard', 'trace']);
    expect(comp(c, 'sdd-engineering', 'trace')).toMatchObject({
      events: ['SessionStart'], description: 'Runs on SessionStart', invocation: null,
      path: 'plugins/sdd-engineering/scripts/trace.mjs',
    });
    expect(comp(c, 'sdd-engineering', 'bash-guard')).toMatchObject({ events: ['PreToolUse'], description: 'Runs on PreToolUse' });
  });

  it('takes the excerpt from the first two non-heading paragraphs of the body', () => {
    const c = build();
    expect(comp(c, 'sdd-engineering', 'implementer').excerpt).toBe(
      "It gets its lane's brief, not the whole plan:\nthe header, the criteria and its steps.\n\nIt does not commit or push.",
    );
    expect(excerpt('# Title\n```sh\nnpm test\n```\n\nOne.\n\n## Two\nTwo.\n\nThree.')).toBe('One.\n\nTwo.');
  });

  it('parses the CHANGELOG newest first, without Unreleased', () => {
    const c = build();
    expect(plugin(c, 'sdd-engineering').changelog).toEqual([
      { version: '1.1.0', date: '2026-10-20', summary: 'A hook blocks git push to the default branch.' },
      { version: '1.0.0', date: '2026-10-18', summary: 'First release: the implementer agent and the run-plan skill. Verified with research-tools 1.0.0.' },
    ]);
  });

  it('gives a plugin with no README and no CHANGELOG null, [] and one warning', () => {
    const c = build();
    const rt = plugin(c, 'research-tools');
    expect(rt.readme).toBeNull();
    expect(rt.changelog).toEqual([]);
    expect(c.warnings.filter((w) => w.includes('research-tools'))).toHaveLength(1);
    expect(c.warnings).toHaveLength(1);
  });

  it('gives a plugin with no component directories an empty component list', () => {
    const root = copyFixture();
    rmSync(join(root, 'plugins/research-tools/agents'), { recursive: true });
    expect(plugin(build(root), 'research-tools').components).toEqual([]);
  });

  it('marks every plugin not released when there is no stable file', () => {
    const root = copyFixture();
    rmSync(join(root, '.claude-plugin/stable'), { recursive: true });
    const c = build(root);
    expect(c.plugins.map((p) => p.stableVersion)).toEqual([null, null]);
    expect(c.warnings.some((w) => w.includes('stable'))).toBe(true);
  });

  it('throws when the CHANGELOG newest version differs from plugin.json', () => {
    const root = copyFixture();
    editJson(join(root, 'plugins/sdd-engineering/.claude-plugin/plugin.json'), (p) => { p.version = '1.0.0'; });
    expect(() => build(root)).toThrow('CHANGELOG newest version 1.1.0 ≠ plugin.json 1.0.0 in sdd-engineering');
  });

  it('throws naming a marketplace entry whose source has no plugin.json', () => {
    const root = copyFixture();
    editJson(join(root, '.claude-plugin/marketplace.json'), (m) => { m.plugins.push({ name: 'ghost', source: './plugins/ghost' }); });
    expect(() => build(root)).toThrow(/ghost/);
  });

  it('throws naming a marketplace entry whose plugin.json name differs', () => {
    const root = copyFixture();
    editJson(join(root, 'plugins/research-tools/.claude-plugin/plugin.json'), (p) => { p.name = 'research-kit'; });
    expect(() => build(root)).toThrow(/research-tools.*research-kit/);
  });
});

describe('build-catalog CLI', () => {
  it('writes catalog.json and exits 0', () => {
    const out = join(copyFixture(), 'out', 'catalog.json');
    execFileSync(process.execPath, [script, '--root', fixture, '--out', out], { stdio: 'pipe' });
    const c = JSON.parse(readFileSync(out, 'utf8'));
    expect(c.plugins.map((p: { name: string }) => p.name)).toEqual(['sdd-engineering', 'research-tools']);
  });

  it('exits non-zero with the reason when the build throws', () => {
    const root = copyFixture();
    editJson(join(root, 'plugins/sdd-engineering/.claude-plugin/plugin.json'), (p) => { p.version = '1.0.0'; });
    const r = spawnSync(process.execPath, [script, '--root', root, '--out', join(root, 'catalog.json')], { encoding: 'utf8' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('CHANGELOG newest version 1.1.0 ≠ plugin.json 1.0.0 in sdd-engineering');
  });
});
