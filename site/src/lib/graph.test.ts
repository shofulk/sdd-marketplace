import { describe, expect, it } from 'vitest';
import type { Plugin } from '../types';
import { layoutGraph, NODE_H, NODE_W } from './graph';

function plugin(name: string, deps: string[] = []): Plugin {
  return {
    name, displayName: name, description: '', author: '', keywords: [], version: '1.0.0', stableVersion: null,
    dependencies: deps.map((d) => ({ name: d, range: '^1.0.0' })), readme: null, changelog: [], components: [],
    path: `plugins/${name}`,
  };
}

// The spec's graph (§3.2): sdd-engineering depends on the three, architecture-review on engineering-paved-path.
const specGraph = [
  plugin('engineering-paved-path'),
  plugin('research-tools'),
  plugin('architecture-review', ['engineering-paved-path']),
  plugin('sdd-engineering', ['engineering-paved-path', 'research-tools', 'architecture-review']),
];

describe('layoutGraph', () => {
  it('levels each plugin by its longest dependency path from a plugin nobody depends on', () => {
    const g = layoutGraph(specGraph);
    const level = Object.fromEntries(g.nodes.map((n) => [n.name, n.level]));
    expect(level).toEqual({
      'sdd-engineering': 0, 'research-tools': 1, 'architecture-review': 1, 'engineering-paved-path': 2,
    });
  });

  it('has one edge per dependency, with its range', () => {
    const g = layoutGraph(specGraph);
    expect(g.edges).toHaveLength(4);
    expect(g.edges).toContainEqual({ from: 'architecture-review', to: 'engineering-paved-path', range: '^1.0.0' });
  });

  it('spaces nodes evenly per level inside the canvas', () => {
    const g = layoutGraph(specGraph);
    const level1 = g.nodes.filter((n) => n.level === 1).map((n) => n.x).sort((a, b) => a - b);
    expect(level1).toHaveLength(2);
    expect(level1[0] + level1[1]).toBeCloseTo(g.width); // symmetric around the middle
    expect(level1[1] - level1[0]).toBeGreaterThanOrEqual(NODE_W);
    for (const n of g.nodes) {
      expect(n.x - NODE_W / 2).toBeGreaterThanOrEqual(0);
      expect(n.x + NODE_W / 2).toBeLessThanOrEqual(g.width);
      expect(n.y + NODE_H / 2).toBeLessThanOrEqual(g.height);
    }
    const ys = [0, 1, 2].map((l) => g.nodes.find((n) => n.level === l)!.y);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it('ignores a dependency that is not in the catalog and survives a cycle', () => {
    const g = layoutGraph([plugin('a', ['b', 'elsewhere']), plugin('b', ['a'])]);
    expect(g.edges.map((e) => `${e.from}>${e.to}`)).toEqual(['a>b', 'b>a']);
    expect(g.nodes).toHaveLength(2);
  });
});
