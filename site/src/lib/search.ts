import type { Catalog, Component, Plugin } from '../types';
import { componentHref, pluginHref } from './catalog';
import type { ItemKind } from './catalog';

export interface SearchItem {
  id: string;
  kind: ItemKind;
  name: string;
  display: string;
  description: string;
  keywords: string[]; // a component carries its plugin's keywords
  text: string; // the plugin's README or the component's excerpt
  plugin: Plugin;
  component: Component | null;
}

/** One item per plugin and per component, in catalog order. */
export function searchItems(catalog: Catalog): SearchItem[] {
  return catalog.plugins.flatMap((plugin) => [
    {
      id: `p:${plugin.name}`, kind: 'plugin' as const, name: plugin.name, display: plugin.displayName,
      description: plugin.description, keywords: plugin.keywords, text: plugin.readme ?? '', plugin, component: null,
    },
    ...plugin.components.map((c) => ({
      id: `c:${plugin.name}:${c.kind}:${c.name}`, kind: c.kind, name: c.name, display: c.name,
      description: c.description, keywords: plugin.keywords, text: c.excerpt, plugin, component: c,
    })),
  ]);
}

/**
 * Every query term must match: a term in the name or display name adds 5, a term elsewhere
 * (description, keywords, excerpt, plugin name) adds 1. An empty query scores 1.
 */
export function score(item: SearchItem, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const head = `${item.name} ${item.display}`.toLowerCase();
  const hay = [item.description, item.keywords.join(' '), item.text, item.plugin.name].join(' ').toLowerCase();
  let total = 0;
  for (const term of terms) {
    if (head.includes(term)) total += 5;
    else if (hay.includes(term)) total += 1;
    else return 0;
  }
  return total;
}

export function itemHref(item: SearchItem): string {
  return item.component ? componentHref(item.plugin.name, item.component) : pluginHref(item.plugin.name);
}
