import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Palette } from './components/Palette';
import { useCatalog } from './data/useCatalog';
import { ComponentPage } from './screens/ComponentPage';
import { Home } from './screens/Home';
import { News } from './screens/News';
import { NotFound } from './screens/NotFound';
import { PluginPage } from './screens/PluginPage';
import { Search } from './screens/Search';
import { Start } from './screens/Start';
import type { Catalog } from './types';

type Theme = 'light' | 'dark';

function systemPrefersLight(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch {
    return false; // dark first, as in the design
  }
}

/** The catalog's screens for one loaded catalog. Rendered inside a router. */
export function CatalogApp({ catalog }: { catalog: Catalog }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [palette, setPalette] = useState(false);
  const { pathname } = useLocation();
  const dark = theme ? theme === 'dark' : !systemPrefersLight();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((open) => !open);
      } else if (e.key === 'Escape') {
        setPalette(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const toggleTheme = () => {
    const next: Theme = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
  };
  const notFound = <NotFound />;

  return (
    <>
      <Header catalog={catalog} dark={dark} onOpenPalette={() => setPalette(true)} onToggleTheme={toggleTheme} />
      <Routes>
        <Route path="/" element={<Home catalog={catalog} />} />
        <Route path="/search" element={<Search catalog={catalog} />} />
        <Route path="/plugin/:name" element={<PluginPage catalog={catalog} notFound={notFound} />} />
        <Route path="/plugin/:name/:kind/:item" element={<ComponentPage catalog={catalog} notFound={notFound} />} />
        <Route path="/start" element={<Start catalog={catalog} />} />
        <Route path="/news" element={<News catalog={catalog} />} />
        <Route path="*" element={notFound} />
      </Routes>
      <Footer catalog={catalog} />
      {palette ? <Palette catalog={catalog} onClose={() => setPalette(false)} /> : null}
    </>
  );
}

function LoadError({ error }: { error?: string }) {
  return (
    <main className="w-plugin">
      <div className="empty" role="alert">
        <h3>The catalog could not be loaded</h3>
        <p>{error}</p>
        <button className="btn" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </main>
  );
}

function Loader() {
  const state = useCatalog();
  if (state.status === 'error') return <LoadError error={state.error} />;
  if (state.status === 'loading' || !state.catalog) {
    return <main className="w-plugin"><p className="muted" role="status">Loading the catalog…</p></main>;
  }
  return <CatalogApp catalog={state.catalog} />;
}

export default function App() {
  return (
    <HashRouter>
      <Loader />
    </HashRouter>
  );
}
