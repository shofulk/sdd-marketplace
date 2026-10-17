import { HashRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { useCatalog } from './data/useCatalog';
import { ComponentPage } from './screens/ComponentPage';
import { Home } from './screens/Home';
import { PluginPage } from './screens/PluginPage';
import { Search } from './screens/Search';
import type { Catalog } from './types';

function Placeholder({ title }: { title: string }) {
  return (
    <main className="w-plugin">
      <h1 className="page-title">{title}</h1>
    </main>
  );
}

/** The catalog's screens for one loaded catalog. Rendered inside a router. */
export function CatalogApp({ catalog }: { catalog: Catalog }) {
  return (
    <>
      <Header catalog={catalog} dark onOpenPalette={() => {}} onToggleTheme={() => {}} />
      <Routes>
        <Route path="/" element={<Home catalog={catalog} />} />
        <Route path="/search" element={<Search catalog={catalog} />} />
        <Route path="/plugin/:name" element={<PluginPage catalog={catalog} notFound={<Placeholder title="Not found" />} />} />
        <Route path="/plugin/:name/:kind/:item" element={<ComponentPage catalog={catalog} notFound={<Placeholder title="Not found" />} />} />
        <Route path="/start" element={<Placeholder title="Connect the marketplace" />} />
        <Route path="/news" element={<Placeholder title="What's new" />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Routes>
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
