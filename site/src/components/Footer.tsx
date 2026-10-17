import { Link } from 'react-router-dom';
import { componentCount, plural } from '../lib/catalog';
import type { Catalog } from '../types';

/** "2026-10-17 18:30 UTC" — the same text in every time zone. */
export function formatBuildTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export function Footer({ catalog }: { catalog: Catalog }) {
  const { sha, builtAt } = catalog.build;
  const short = /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7) : sha;
  const repo = catalog.marketplace.repo;
  return (
    <footer className="foot">
      <span>
        build{' '}
        {repo && short !== sha ? <a href={`https://github.com/${repo}/commit/${sha}`} title={sha}>{short}</a> : <span title={sha}>{short}</span>}
        {' · '}{formatBuildTime(builtAt)}
      </span>
      <span>{plural(catalog.plugins.length, 'plugin', 'plugins')} · {plural(componentCount(catalog), 'component', 'components')}</span>
      <Link to="/start">Connect the marketplace</Link>
    </footer>
  );
}
