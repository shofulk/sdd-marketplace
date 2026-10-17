import { describe, expect, it } from 'vitest';
import { catalogFixture } from '../test/catalog.fixture';
import { score, searchItems } from './search';

const items = searchItems(catalogFixture);
const item = (name: string) => items.find((i) => i.name === name)!;

describe('searchItems', () => {
  it('has one item per plugin and per component', () => {
    expect(items).toHaveLength(2 + 7);
    expect(items.filter((i) => i.kind === 'plugin').map((i) => i.name)).toEqual(['sdd-engineering', 'research-tools']);
    expect(item('implementer')).toMatchObject({ kind: 'agent', display: 'implementer', keywords: ['sdd', 'workflow', 'agents'] });
    expect(item('sdd-engineering').display).toBe('SDD Engineering');
  });
});

describe('score', () => {
  it('scores 5 for a term in the name or display name', () => {
    expect(score(item('plan-verifier'), 'verifier')).toBe(5);
    expect(score(item('sdd-engineering'), 'engineering')).toBe(5);
  });

  it('scores 1 for a term only in the description, keywords, excerpt or plugin name', () => {
    expect(score(item('plan-verifier'), 'evidence')).toBe(1);
    expect(score(item('implementer'), 'workflow')).toBe(1);
    expect(score(item('implementer'), 'lane')).toBe(1);
    expect(score(item('researcher'), 'research-tools')).toBe(1);
  });

  it('adds the terms up and scores 0 when any term is missing', () => {
    expect(score(item('plan-verifier'), 'Verifier EVIDENCE')).toBe(6);
    expect(score(item('plan-verifier'), 'verifier banana')).toBe(0);
  });

  it('scores 1 for an empty query', () => {
    expect(score(item('trace'), '')).toBe(1);
    expect(score(item('trace'), '   ')).toBe(1);
  });
});
