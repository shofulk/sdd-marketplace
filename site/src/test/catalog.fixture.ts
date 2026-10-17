import type { Catalog, Component } from '../types';

// Test data only: two plugins, one with a dependency and a stable release, one with no README,
// no CHANGELOG and no stable release.

const sdd = 'sdd-engineering';

function agent(name: string, description: string, extra: Partial<Component> = {}): Component {
  return {
    kind: 'agent', name, description, invocation: `@agent-${sdd}:${name}`,
    tools: [], model: null, skills: [], events: [], excerpt: '', path: `plugins/${sdd}/agents/${name}.md`, ...extra,
  };
}

export const catalogFixture: Catalog = {
  marketplace: {
    name: 'sdd',
    owner: 'shofulk',
    description: 'Spec Driven Development plugins for Claude Code.',
    repo: 'shofulk/sdd-marketplace',
  },
  build: { sha: 'abc1234def5678', builtAt: '2026-10-17T18:30:00.000Z' },
  warnings: [],
  plugins: [
    {
      name: sdd,
      displayName: 'SDD Engineering',
      description: 'Spec, plan, run the plan, retro.',
      author: 'shofulk',
      keywords: ['sdd', 'workflow', 'agents'],
      version: '1.1.0',
      stableVersion: '1.0.0',
      dependencies: [{ name: 'research-tools', range: '^1.0.0' }],
      readme: '# SDD Engineering\n\nTakes a feature from **request** to a verified change.\n\n- spec\n- plan\n',
      changelog: [
        { version: '1.1.0', date: '2026-10-20', summary: 'Blocks git push to the default branch.' },
        { version: '1.0.0', date: '2026-10-18', summary: 'First release.' },
      ],
      path: `plugins/${sdd}`,
      components: [
        {
          kind: 'skill', name: 'run-plan', description: 'Runs an approved plan through lanes and checks.',
          invocation: `/${sdd}:run-plan`, tools: [], model: null, skills: [], events: [],
          excerpt: 'Lanes go interface, red tests, implementation.\n\nThen the checks run once.',
          path: `plugins/${sdd}/skills/run-plan/SKILL.md`,
        },
        {
          kind: 'skill', name: 'spec-writing', description: 'How to write a spec.',
          invocation: null, tools: [], model: null, skills: [], events: [],
          excerpt: 'Preloaded into spec-creator.', path: `plugins/${sdd}/skills/spec-writing/SKILL.md`,
        },
        agent('implementer', 'Implements an approved plan step by step.', {
          tools: ['Read', 'Edit', 'Bash'], model: 'sonnet', skills: ['onion-architecture'],
          excerpt: 'It gets its lane brief, not the whole plan.\n\nIt does not commit or push.',
        }),
        agent('plan-verifier', 'Checks every acceptance criterion against evidence.', {
          tools: ['Read', 'Grep'], model: 'opus',
        }),
        {
          kind: 'hook', name: 'trace', description: 'Runs on SessionStart',
          invocation: null, tools: [], model: null, skills: [], events: ['SessionStart'],
          excerpt: '', path: `plugins/${sdd}/scripts/trace.mjs`,
        },
        {
          kind: 'hook', name: 'bash-guard', description: 'Runs on PreToolUse',
          invocation: null, tools: [], model: null, skills: [], events: ['PreToolUse'],
          excerpt: '', path: `plugins/${sdd}/scripts/bash-guard.mjs`,
        },
      ],
    },
    {
      name: 'research-tools',
      displayName: 'Research Tools',
      description: 'A read-only researcher agent.',
      author: 'shofulk',
      keywords: ['research', 'read-only'],
      version: '1.0.0',
      stableVersion: null,
      dependencies: [],
      readme: null,
      changelog: [],
      path: 'plugins/research-tools',
      components: [
        {
          kind: 'agent', name: 'researcher', description: 'Answers questions about the repository with evidence.',
          invocation: '@agent-research-tools:researcher', tools: ['Read', 'Grep', 'WebFetch'], model: 'sonnet',
          skills: [], events: [], excerpt: 'Returns a structured report.', path: 'plugins/research-tools/agents/researcher.md',
        },
      ],
    },
  ],
};
