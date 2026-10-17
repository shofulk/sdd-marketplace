import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { KindDot } from '../components/KindBadge';
import { allKeywords, cap, countByKind, KIND_ORDER, KIND_PLURAL, plural } from '../lib/catalog';
import type { ItemKind } from '../lib/catalog';
import { score, searchItems } from '../lib/search';
import type { Catalog } from '../types';
import type { SearchSeed } from './Home';

type Sort = 'relevance' | 'name';

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function Search({ catalog }: { catalog: Catalog }) {
  const navigate = useNavigate();
  const seed = (useLocation().state ?? {}) as SearchSeed;
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const [kinds, setKinds] = useState<ItemKind[]>(() => seed.kinds ?? []);
  const [kws, setKws] = useState<string[]>(() => seed.kws ?? []);
  const [sort, setSort] = useState<Sort>('relevance');

  const items = useMemo(() => searchItems(catalog), [catalog]);
  const counts = useMemo(() => countByKind(catalog), [catalog]);
  const keywords = useMemo(() => allKeywords(catalog), [catalog]);

  const results = useMemo(() => {
    const hits = items
      .map((it) => ({ it, s: score(it, query) }))
      .filter(({ it, s }) => s > 0
        && (!kinds.length || kinds.includes(it.kind))
        && kws.every((k) => it.keywords.includes(k)));
    if (sort === 'name') hits.sort((a, b) => a.it.display.localeCompare(b.it.display));
    else hits.sort((a, b) => b.s - a.s || KIND_ORDER.indexOf(a.it.kind) - KIND_ORDER.indexOf(b.it.kind));
    return hits.map((h) => h.it);
  }, [items, query, kinds, kws, sort]);

  const reset = () => {
    setKinds([]);
    setKws([]);
    if (query) navigate('/search', { replace: true });
  };
  const heading = query ? `Results for "${query}"` : kinds.length === 1 ? cap(KIND_PLURAL[kinds[0]]) : 'The whole catalog';

  return (
    <main className="w-search">
      <div className="search-layout">
        <aside className="facets" aria-label="Filters">
          <div className="head">
            <span className="cap">Filters</span>
            <button className="reset" onClick={reset}>Reset</button>
          </div>
          <div className="lbl">Type</div>
          <div className="fkinds">
            {KIND_ORDER.map((k) => {
              const on = kinds.includes(k);
              return (
                <button key={k} className={`fk${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setKinds(toggle(kinds, k))}>
                  <KindDot kind={k} />
                  <span className="grow">{KIND_PLURAL[k]}</span>
                  <span className="cnt num">{counts[k]}</span>
                </button>
              );
            })}
          </div>
          <div className="lbl">Keywords</div>
          <div className="kws">
            {keywords.map((k) => {
              const on = kws.includes(k);
              return (
                <button key={k} className={`kw${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setKws(toggle(kws, k))}>{k}</button>
              );
            })}
          </div>
        </aside>
        <section className="results">
          <div className="res-head">
            <div>
              <h1>{heading}</h1>
              <div className="count num">{plural(results.length, 'result', 'results')}</div>
            </div>
            <label className="sortlbl">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="relevance">Relevance</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          {results.length ? (
            <ul className="cards" aria-label="Results">
              {results.map((it) => <Card key={it.id} item={it} catalog={catalog} />)}
            </ul>
          ) : (
            <div className="empty">
              <h3>Nothing found</h3>
              <p>Reset the filters or change the query.</p>
              <button className="btn" onClick={reset}>Reset filters</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
