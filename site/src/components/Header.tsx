import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Catalog } from '../types';

interface Props {
  catalog: Catalog;
  dark: boolean;
  onOpenPalette: () => void;
  onToggleTheme: () => void;
}

export function Header({ catalog, dark, onOpenPalette, onToggleTheme }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onSearch = location.pathname === '/search';
  const repo = catalog.marketplace.repo;

  return (
    <header className="top">
      <Link to="/" className="brand" aria-label="Catalog home">
        <span className="logo" aria-hidden="true">◆</span>
        <span className="brand-name">Catalog</span>
        <span className="tag hide-sm">{catalog.marketplace.name}</span>
      </Link>
      <div className="search-wrap">
        <span className="glyph" aria-hidden="true">⌕</span>
        <input
          type="search"
          value={onSearch ? params.get('q') ?? '' : ''}
          placeholder="Search the catalog…"
          aria-label="Search the catalog"
          onChange={(e) => {
            const q = e.target.value;
            navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { replace: onSearch, state: onSearch ? location.state : undefined });
          }}
        />
      </div>
      <div className="hactions">
        <button className="hbtn" onClick={onOpenPalette} aria-label="Quick open">⌘K</button>
        <button className="hbtn" onClick={onToggleTheme} aria-label="Toggle theme">{dark ? '☾' : '☀'}</button>
        <Link className="hlink hide-sm" to="/start">Connect</Link>
        {repo ? <a className="hlink hide-sm" href={`https://github.com/${repo}`} target="_blank" rel="noopener">GitHub ↗</a> : null}
      </div>
    </header>
  );
}
