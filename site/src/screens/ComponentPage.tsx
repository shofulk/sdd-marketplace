import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { KindBadge } from '../components/KindBadge';
import { Markdown } from '../components/Markdown';
import { componentHref, pluginHref } from '../lib/catalog';
import type { Catalog } from '../types';

function Fact({ label, values }: { label: string; values: string[] }) {
  return (
    <li aria-label={label}>
      <div className="cap">{label}</div>
      <div className="pills">{values.map((v) => <span key={v} className="pill">{v}</span>)}</div>
    </li>
  );
}

export function ComponentPage({ catalog, notFound }: { catalog: Catalog; notFound: ReactNode }) {
  const { name, kind, item } = useParams();
  const plugin = catalog.plugins.find((p) => p.name === name);
  const component = plugin?.components.find((c) => c.kind === kind && c.name === item);
  if (!plugin || !component) return <>{notFound}</>;

  const repo = catalog.marketplace.repo;
  const dir = component.path.split('/').slice(0, -1).join('/');
  const others = plugin.components.filter((c) => c !== component).slice(0, 4);

  return (
    <main className="w-art">
      <nav className="crumbs" aria-label="Breadcrumbs">
        <Link to="/search">Catalog</Link>
        <span className="sep"> / </span>
        <Link to={pluginHref(plugin.name)}>{plugin.displayName}</Link>
        <span className="sep"> / {component.name}</span>
      </nav>
      <div className="a-title">
        <KindBadge kind={component.kind} />
        <h1>{component.name}</h1>
        {component.invocation ? <span className="inv-chip">{component.invocation}</span> : null}
      </div>
      <p className="p-desc">{component.description}</p>

      <ul className="facts" aria-label="Facts">
        {component.tools.length ? <Fact label="Tools" values={component.tools} /> : null}
        {component.model ? <Fact label="Model" values={[component.model]} /> : null}
        {component.skills.length ? <Fact label="Preloaded skills" values={component.skills} /> : null}
        {component.events.length ? <Fact label={component.events.length > 1 ? 'Events' : 'Event'} values={component.events} /> : null}
        <Fact label="Plugin" values={[`${plugin.name} v${plugin.version}`]} />
      </ul>

      <section className="sec doc" aria-labelledby="h-doc">
        <div className="sec-head">
          <h2 id="h-doc">Documentation</h2>
          {repo ? <a href={`https://github.com/${repo}/blob/main/${component.path}`} target="_blank" rel="noopener">{component.path} ↗</a> : null}
        </div>
        <div className="panel">
          {component.excerpt
            ? <Markdown text={component.excerpt} base={repo ? `https://github.com/${repo}/blob/main/${dir}` : null} />
            : <p>No documentation</p>}
        </div>
      </section>

      {others.length ? (
        <section className="sec" aria-labelledby="h-more">
          <div className="sec-head"><h2 id="h-more">More in this plugin</h2></div>
          <div className="comp-grid">
            {others.map((o) => (
              <Link key={`${o.kind}:${o.name}`} className="comp" to={componentHref(plugin.name, o)}>
                <div className="l1"><span className="nm">{o.name}</span><KindBadge kind={o.kind} /></div>
                <div className="ds">{o.description}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
