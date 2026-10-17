import { useNavigate } from 'react-router-dom';
import { pluginHref } from '../lib/catalog';
import { layoutGraph, NODE_H, NODE_W } from '../lib/graph';
import type { Plugin } from '../types';

export function Graph({ plugins }: { plugins: Plugin[] }) {
  const navigate = useNavigate();
  const g = layoutGraph(plugins);
  const at = new Map(g.nodes.map((n) => [n.name, n]));
  const version = new Map(plugins.map((p) => [p.name, p.version]));
  const open = (name: string) => navigate(pluginHref(name));

  return (
    <div className="graph">
      <svg viewBox={`0 0 ${g.width} ${g.height}`} role="group" aria-label={`Dependency graph of ${plugins.length} plugins`}>
        <defs>
          <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arrow" />
          </marker>
        </defs>
        {g.edges.map((e) => {
          const a = at.get(e.from)!;
          const b = at.get(e.to)!;
          const down = b.y > a.y;
          const y1 = down ? a.y + NODE_H / 2 : a.y;
          const y2 = down ? b.y - NODE_H / 2 - 2 : b.y;
          const x1 = down ? a.x : a.x + (b.x > a.x ? NODE_W / 2 : -NODE_W / 2);
          const x2 = down ? b.x : b.x + (b.x > a.x ? -NODE_W / 2 - 2 : NODE_W / 2 + 2);
          return (
            <g key={`${e.from}>${e.to}`}>
              <path className="edge" d={`M${x1},${y1} L${x2},${y2}`} markerEnd="url(#ar)" />
              {e.range ? <text className="range" x={(x1 + x2) / 2 + 6} y={(y1 + y2) / 2} textAnchor="start">{e.range}</text> : null}
            </g>
          );
        })}
        {g.nodes.map((n) => (
          <g
            key={n.name}
            className={`node${n.level === 0 ? ' root' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={`Open ${n.name}`}
            onClick={() => open(n.name)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(n.name); } }}
          >
            <rect x={n.x - NODE_W / 2} y={n.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={9} />
            <text x={n.x} y={n.y + 4.5} textAnchor="middle">{n.name}</text>
            <text x={n.x} y={n.y + NODE_H / 2 + 15} textAnchor="middle" className="range">v{version.get(n.name)}</text>
          </g>
        ))}
      </svg>
      <div className="legend">
        An arrow points from a plugin to a plugin it depends on, labelled with the version range. Click a node to open the plugin.
      </div>
    </div>
  );
}
