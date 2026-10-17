// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const workflow = parse(readFileSync(join(here, '..', '..', '.github', 'workflows', 'pages.yml'), 'utf8'));

interface Step { uses?: string; run?: string; with?: Record<string, unknown>; 'working-directory'?: string }
interface Job { steps: Step[]; needs?: string | string[]; environment?: { name: string; url?: string }; defaults?: { run?: { 'working-directory'?: string } } }

const jobs: Record<string, Job> = workflow.jobs;
const usesStep = (job: Job, action: string) => job.steps.find((s) => s.uses?.startsWith(`${action}@`));
const runStep = (job: Job, cmd: string) => job.steps.find((s) => s.run?.split('\n').map((l) => l.trim()).includes(cmd));
const buildJob = Object.values(jobs).find((j) => usesStep(j, 'actions/upload-pages-artifact'))!;
const deployJob = Object.values(jobs).find((j) => usesStep(j, 'actions/deploy-pages'))!;
const buildName = Object.keys(jobs).find((k) => jobs[k] === buildJob)!;

describe('pages workflow', () => {
  it('runs on every push to main and every tag push', () => {
    expect(workflow.on.push.branches).toEqual(['main']);
    expect(workflow.on.push.tags).toEqual(['*']);
  });

  it('grants pages: write and id-token: write', () => {
    expect(workflow.permissions).toMatchObject({ pages: 'write', 'id-token': 'write' });
  });

  it('builds the site: full checkout, Node from site/.nvmrc, npm ci and npm run build in site/', () => {
    expect(buildJob).toBeDefined();
    expect(usesStep(buildJob, 'actions/checkout')?.with?.['fetch-depth']).toBe(0);
    expect(usesStep(buildJob, 'actions/setup-node')?.with?.['node-version-file']).toBe('site/.nvmrc');
    // .nvmrc says 22; jsdom needs >= 22.22.2, so do not settle for an older cached 22.x on the runner
    expect(usesStep(buildJob, 'actions/setup-node')?.with?.['check-latest']).toBe(true);
    for (const cmd of ['npm ci', 'npm run build']) {
      const step = runStep(buildJob, cmd);
      expect(step, cmd).toBeDefined();
      expect(step!['working-directory'] ?? buildJob.defaults?.run?.['working-directory']).toBe('site');
    }
    expect(buildJob.steps.indexOf(runStep(buildJob, 'npm ci')!)).toBeLessThan(buildJob.steps.indexOf(runStep(buildJob, 'npm run build')!));
  });

  it('makes the stable branch available to build-catalog before the build (SDD-001)', () => {
    const fetch = buildJob.steps.find((s) => /git fetch\b.*refs\/heads\/stable:refs\/remotes\/origin\/stable/.test(s.run ?? ''));
    expect(fetch).toBeDefined();
    expect(fetch!.run).toMatch(/\|\|/); // a repository without a stable branch still builds
    expect(buildJob.steps.indexOf(fetch!)).toBeLessThan(buildJob.steps.indexOf(runStep(buildJob, 'npm run build')!));
  });

  it('uploads site/dist as the Pages artifact', () => {
    expect(usesStep(buildJob, 'actions/upload-pages-artifact')?.with?.path).toBe('site/dist');
  });

  it('deploys after the build to the github-pages environment', () => {
    expect(deployJob).toBeDefined();
    expect(deployJob.environment?.name).toBe('github-pages');
    expect([deployJob.needs].flat()).toContain(buildName);
  });
});
