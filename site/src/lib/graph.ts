import type { Plugin } from '../types';

export const NODE_W = 196;
export const NODE_H = 40;
const GAP_X = 32;
const LEVEL_GAP = 128;
const PAD_TOP = 20;
const LABEL_SPACE = 30; // the version label under the lowest row
const MIN_WIDTH = 660;

export interface GraphLayout {
  nodes: { name: string; level: number; x: number; y: number }[];
  edges: { from: string; to: string; range: string | null }[];
  width: number;
  height: number;
}

/**
 * Lays the dependency graph out in rows: a plugin's level is its longest dependency path from a
 * plugin nobody depends on, and the nodes of a level are spaced evenly across the canvas.
 * Dependencies outside the catalog are not drawn; a cycle cannot loop (levels are capped).
 */
export function layoutGraph(plugins: Plugin[]): GraphLayout {
  const names = plugins.map((p) => p.name);
  const known = new Set(names);
  const edges = plugins.flatMap((p) =>
    p.dependencies
      .filter((d) => known.has(d.name) && d.name !== p.name)
      .map((d) => ({ from: p.name, to: d.name, range: d.range })),
  );

  const level = new Map(names.map((n) => [n, 0]));
  for (let round = 0; round < names.length; round++) {
    let changed = false;
    for (const e of edges) {
      const next = level.get(e.from)! + 1;
      if (next > level.get(e.to)! && next < names.length) {
        level.set(e.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const rows = new Map<number, string[]>();
  for (const n of names) rows.set(level.get(n)!, [...(rows.get(level.get(n)!) ?? []), n]);
  const widest = Math.max(1, ...[...rows.values()].map((r) => r.length));
  const width = Math.max(MIN_WIDTH, widest * NODE_W + (widest + 1) * GAP_X);
  const maxLevel = Math.max(0, ...level.values());

  const nodes = names.map((name) => {
    const l = level.get(name)!;
    const row = rows.get(l)!;
    const i = row.indexOf(name);
    return { name, level: l, x: (width * (2 * i + 1)) / (2 * row.length), y: PAD_TOP + NODE_H / 2 + l * LEVEL_GAP };
  });
  return { nodes, edges, width, height: PAD_TOP + NODE_H + maxLevel * LEVEL_GAP + LABEL_SPACE };
}
