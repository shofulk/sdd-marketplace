import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemHref, score, searchItems } from '../lib/search';
import type { SearchItem } from '../lib/search';
import type { Catalog } from '../types';
import { KindDot } from './KindBadge';

const LIMIT = 9;

/** The ⌘K quick-open: type to filter, arrows to select, Enter to open, Escape to close. */
export function Palette({ catalog, onClose }: { catalog: Catalog; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const items = useMemo(() => searchItems(catalog), [catalog]);
  const list = useMemo(
    () => items
      .map((it) => ({ it, s: score(it, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, LIMIT)
      .map((x) => x.it),
    [items, query],
  );

  const choose = (it: SearchItem | undefined) => {
    if (!it) return;
    onClose();
    navigate(itemHref(it));
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Quick open" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={list[sel] ? `palette-${sel}` : undefined}
          aria-label="Find a plugin, skill, agent or hook"
          value={query}
          placeholder="A plugin, skill, agent or hook…"
          onChange={(e) => { setQuery(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(sel + 1, list.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(sel - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); choose(list[sel]); }
          }}
        />
        <div className="items">
          {list.length ? (
            <ul id="palette-list" role="listbox" aria-label="Matches" className="list plain">
              {list.map((it, i) => (
                <li
                  key={it.id}
                  id={`palette-${i}`}
                  role="option"
                  aria-selected={i === sel}
                  className={`pitem${i === sel ? ' sel' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => choose(it)}
                >
                  <KindDot kind={it.kind} />
                  <span className="grow">{it.display}</span>
                  <span className="meta">{it.kind === 'plugin' ? `v${it.plugin.version}` : it.plugin.name}</span>
                </li>
              ))}
            </ul>
          ) : <div className="none">Nothing found</div>}
        </div>
        <div className="hint">↑↓ select · Enter open · Esc close</div>
      </div>
    </div>
  );
}
