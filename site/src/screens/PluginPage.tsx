import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { CopyButton } from '../components/CopyButton';
import { KindDot, Ver } from '../components/KindBadge';
import { Markdown } from '../components/Markdown';
import { COMPONENT_KINDS, componentHref, installCommand, KIND_PLURAL, plural, pluginHref } from '../lib/catalog';
import type { Catalog, Component } from '../types';

function componentHint(c: Component): string {
  return c.invocation ?? c.events.join(', ');
}

export function PluginPage({ catalog, notFound }: { catalog: Catalog; notFound: ReactNode }) {
  const { name } = useParams();
  const plugin = catalog.plugins.find((p) => p.name === name);
  if (!plugin) return <>{notFound}</>;

  const repo = catalog.marketplace.repo;
  const groups = COMPONENT_KINDS
    .map((kind) => ({ kind, items: plugin.components.filter((c) => c.kind === kind) }))
    .filter((g) => g.items.length);
  const dependents = catalog.plugins.filter((o) => o.dependencies.some((d) => d.name === plugin.name));
  const known = new Set(catalog.plugins.map((p) => p.name));
  const cmd = installCommand(plugin, catalog);

  return (
    <main className="w-plugin">
      <BackButton />
      <div className="p-head">
        <div className="p-icon" aria-hidden="true">◆</div>
        <div className="p-main">
          <div className="p-title">
            <h1>{plugin.displayName}</h1>
            <Ver label="latest" v={plugin.version} />
            {plugin.stableVersion
              ? <Ver label="stable" v={plugin.stableVersion} stable />
              : <span className="ver none">stable: not released</span>}
          </div>
          <p className="p-desc">{plugin.description}</p>
          <div className="p-meta">
            {plugin.name} · {plugin.author || 'unknown author'} · {plural(plugin.components.length, 'component', 'components')}
          </div>
        </div>
      </div>

      <div className="install">
        <div className="term"><span className="pfx">&gt;</span><span className="cmd">{cmd}</span></div>
        <CopyButton text={cmd} className="btn primary" />
        {repo ? <a className="btn" href={`https://github.com/${repo}/tree/main/${plugin.path}`} target="_blank" rel="noopener">GitHub ↗</a> : null}
      </div>

      <section className="sec" aria-labelledby="h-comp">
        <div className="sec-head"><h2 id="h-comp">Composition</h2></div>
        {groups.length ? groups.map((g) => (
          <div key={g.kind} className="comp-group" role="group" aria-label={KIND_PLURAL[g.kind]}>
            <div className="gh">
              <KindDot kind={g.kind} />
              <span className="lbl">{KIND_PLURAL[g.kind]}</span>
              <span className="cnt num">{g.items.length}</span>
            </div>
            <div className="comp-grid">
              {g.items.map((c) => (
                <Link key={c.name} className="comp" to={componentHref(plugin.name, c)}>
                  <div className="l1"><span className="nm">{c.name}</span><span className="inv">{componentHint(c)}</span></div>
                  <div className="ds">{c.description}</div>
                </Link>
              ))}
            </div>
          </div>
        )) : <p className="muted">No components</p>}
      </section>

      {plugin.dependencies.length || dependents.length ? (
        <section className="sec" aria-labelledby="h-deps">
          <div className="sec-head"><h2 id="h-deps">Dependencies</h2></div>
          {plugin.dependencies.length ? (
            <div className="deps">
              {plugin.dependencies.map((d) => known.has(d.name)
                ? <Link key={d.name} className="dep" to={pluginHref(d.name)}>{d.name}{d.range ? <span>{d.range}</span> : null}</Link>
                : <span key={d.name} className="dep">{d.name}{d.range ? <span>{d.range}</span> : null}</span>)}
            </div>
          ) : null}
          {dependents.length ? (
            <div className="dependents">
              Depended on by:{' '}
              {dependents.map((o, i) => (
                <Fragment key={o.name}>{i ? ', ' : ''}<Link to={pluginHref(o.name)}>{o.name}</Link></Fragment>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="sec" aria-labelledby="h-readme">
        <div className="sec-head"><h2 id="h-readme">README</h2></div>
        <div className="panel">
          {plugin.readme
            ? <Markdown text={plugin.readme} base={repo ? `https://github.com/${repo}/blob/main/${plugin.path}` : null} />
            : <p>No README</p>}
        </div>
      </section>

      <section className="sec" aria-labelledby="h-changelog">
        <div className="sec-head"><h2 id="h-changelog">Changelog</h2></div>
        {plugin.changelog.length ? (
          <ul className="list plain">
            {plugin.changelog.map((c) => (
              <li key={c.version} className="cl">
                <div className="l1">
                  <span className="v num">v{c.version}</span>
                  {c.date ? <span className="d">{c.date}</span> : null}
                  {c.version === plugin.stableVersion ? <span className="ver stable">stable</span> : null}
                  {c.version === plugin.version && plugin.version !== plugin.stableVersion ? <span className="ver">latest</span> : null}
                </div>
                <div className="s">{c.summary}</div>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No releases yet</p>}
      </section>
    </main>
  );
}
