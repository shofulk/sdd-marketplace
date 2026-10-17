import { Link, useLocation } from 'react-router-dom';

export function NotFound() {
  const { pathname } = useLocation();
  return (
    <main className="w-plugin">
      <div className="empty">
        <h1 className="page-title">Not found</h1>
        <p>Nothing in the catalog matches <span className="mono">{pathname}</span>.</p>
        <Link className="btn" to="/">Back to the catalog</Link>
      </div>
    </main>
  );
}
