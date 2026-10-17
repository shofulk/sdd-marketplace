import { Link } from 'react-router-dom';
import { installCommand, plural } from '../lib/catalog';
import { itemHref } from '../lib/search';
import type { SearchItem } from '../lib/search';
import type { Catalog } from '../types';
import { CopyButton } from './CopyButton';
import { KindBadge } from './KindBadge';

export function Card({ item, catalog }: { item: SearchItem; catalog: Catalog }) {
  const href = itemHref(item);
  const copyValue = item.component?.invocation ?? installCommand(item.plugin, catalog);
  return (
    <li className="card">
      <div className="body">
        <div className="top">
          <KindBadge kind={item.kind} />
          <span className="v num">v{item.plugin.version}</span>
        </div>
        <h3 className="name"><Link to={href}>{item.display}</Link></h3>
        <p>{item.description}</p>
        <div className="tags">
          {item.keywords.slice(0, 3).map((k) => <span key={k}>#{k}</span>)}
        </div>
      </div>
      <div className="foot">
        <span className="meta">
          {item.component ? item.plugin.name : plural(item.plugin.components.length, 'component', 'components')}
        </span>
        <div className="acts">
          <CopyButton text={copyValue} />
          <Link className="btn primary" to={href}>Open</Link>
        </div>
      </div>
    </li>
  );
}
