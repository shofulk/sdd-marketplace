import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { Ver } from '../components/KindBadge';
import { news, pluginHref } from '../lib/catalog';
import type { Catalog } from '../types';

export function News({ catalog }: { catalog: Catalog }) {
  const navigate = useNavigate();
  const entries = news(catalog);
  return (
    <main className="w-plugin">
      <BackButton />
      <h1 className="page-title spaced">What's new</h1>
      {entries.length ? (
        <ul className="list plain" aria-label="Releases">
          {entries.map((r) => (
            <li key={`${r.plugin.name}@${r.version}`}>
              <button className="row" onClick={() => navigate(pluginHref(r.plugin.name))}>
                <Ver v={r.version} />
                <div className="grow">
                  <div className="title">{r.plugin.displayName}</div>
                  <div className="sub wrap">{r.summary}</div>
                </div>
                <span className="when">{r.date ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No releases yet</p>
      )}
    </main>
  );
}
