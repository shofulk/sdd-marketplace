import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Graph } from '../components/Graph';
import { KindDot, Ver } from '../components/KindBadge';
import { countByKind, KIND_ORDER, KIND_PLURAL, news, pluginHref, topKeywords } from '../lib/catalog';
import type { ItemKind } from '../lib/catalog';
import type { Catalog } from '../types';

export interface SearchSeed { kinds?: ItemKind[]; kws?: string[] }

export function Home({ catalog }: { catalog: Catalog }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const counts = countByKind(catalog);
  const latest = news(catalog).slice(0, 4);
  const searchWith = (seed: SearchSeed) => navigate('/search', { state: seed });

  return (
    <main className="w-home">
      <section className="hero">
        <div className="eyebrow">marketplace {catalog.marketplace.name} · plugins · skills · agents</div>
        <h1>Spec Driven Development<br />for Claude Code</h1>
        <p>Spec → plan → run → retro. Composition and versions are built from the repository files in CI, with no backend.</p>
        <div className="big-search">
          <span className="glyph" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            placeholder='Describe what you need — e.g. "an agent that checks a plan"'
            aria-label="Describe what you need"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search');
            }}
          />
        </div>
        <div className="chips">
          {topKeywords(catalog, 6).map((k) => (
            <button key={k} className="chip" onClick={() => searchWith({ kws: [k] })}>#{k}</button>
          ))}
        </div>
      </section>

      <section className="stats" aria-label="Counts by type">
        {KIND_ORDER.map((k) => (
          <button key={k} className="stat" aria-label={`${counts[k]} ${KIND_PLURAL[k]}`} onClick={() => searchWith({ kinds: [k] })}>
            <b className="num">{counts[k]}</b>
            <span>{KIND_PLURAL[k]}</span>
          </button>
        ))}
      </section>

      <section className="sec" aria-labelledby="h-graph">
        <div className="sec-head"><h2 id="h-graph">Dependency graph</h2></div>
        <Graph plugins={catalog.plugins} />
      </section>

      <section className="sec" aria-labelledby="h-news">
        <div className="sec-head">
          <h2 id="h-news">What's new</h2>
          <Link to="/news">Full feed →</Link>
        </div>
        {latest.length ? (
          <div className="list">
            {latest.map((r) => (
              <button key={`${r.plugin.name}@${r.version}`} className="row" onClick={() => navigate(pluginHref(r.plugin.name))}>
                <Ver v={r.version} />
                <div className="grow">
                  <div className="title">{r.plugin.displayName}</div>
                  <div className="sub">{r.summary}</div>
                </div>
                <span className="when">{r.date ?? ''}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">No releases yet.</p>
        )}
      </section>

      <section className="sec" aria-labelledby="h-kinds">
        <div className="sec-head"><h2 id="h-kinds">Browse by type</h2></div>
        <div className="kinds">
          {KIND_ORDER.map((k) => (
            <button key={k} className="kbtn" onClick={() => searchWith({ kinds: [k] })}>
              <KindDot kind={k} />
              <span className="lbl">{KIND_PLURAL[k]}</span>
              <span className="cnt num">{counts[k]}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
