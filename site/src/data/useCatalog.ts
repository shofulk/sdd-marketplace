import { useEffect, useState } from 'react';
import type { Catalog } from '../types';

export interface CatalogState {
  status: 'loading' | 'ready' | 'error';
  catalog?: Catalog;
  error?: string;
}

export const CATALOG_URL = `${import.meta.env.BASE_URL}catalog.json`;

async function loadCatalog(url: string): Promise<Catalog> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`${url} is not valid JSON`);
  }
  if (!data || typeof data !== 'object' || !Array.isArray((data as Catalog).plugins)) {
    throw new Error(`${url} has no plugins list`);
  }
  return data as Catalog;
}

/** Fetches catalog.json once; the app renders nothing from any other source. */
export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    loadCatalog(CATALOG_URL).then(
      (catalog) => { if (alive) setState({ status: 'ready', catalog }); },
      (e: unknown) => { if (alive) setState({ status: 'error', error: e instanceof Error ? e.message : String(e) }); },
    );
    return () => { alive = false; };
  }, []);
  return state;
}
