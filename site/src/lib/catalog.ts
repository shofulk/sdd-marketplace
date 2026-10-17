import type { Catalog, Component, Kind, Plugin } from '../types';

export type ItemKind = 'plugin' | Kind;
export const KIND_ORDER: ItemKind[] = ['plugin', 'skill', 'agent', 'hook'];
export const COMPONENT_KINDS: Kind[] = ['skill', 'agent', 'hook'];
export const KIND_PLURAL: Record<ItemKind, string> = { plugin: 'plugins', skill: 'skills', agent: 'agents', hook: 'hooks' };

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function installCommand(plugin: Plugin, catalog: Catalog): string {
  return `/plugin install ${plugin.name}@${catalog.marketplace.name}`;
}

export function pluginHref(name: string): string {
  return `/plugin/${encodeURIComponent(name)}`;
}

export function componentHref(plugin: string, c: Pick<Component, 'kind' | 'name'>): string {
  return `/plugin/${encodeURIComponent(plugin)}/${c.kind}/${encodeURIComponent(c.name)}`;
}

export function countByKind(catalog: Catalog): Record<ItemKind, number> {
  const counts: Record<ItemKind, number> = { plugin: catalog.plugins.length, skill: 0, agent: 0, hook: 0 };
  for (const p of catalog.plugins) for (const c of p.components) counts[c.kind]++;
  return counts;
}

export function componentCount(catalog: Catalog): number {
  return catalog.plugins.reduce((n, p) => n + p.components.length, 0);
}

export interface NewsEntry { plugin: Plugin; version: string; date: string | null; summary: string }

function compareVersions(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Every changelog entry of every plugin, newest first: by date, then by version, then by plugin. */
export function news(catalog: Catalog): NewsEntry[] {
  return catalog.plugins
    .flatMap((plugin) => plugin.changelog.map((c) => ({ plugin, ...c })))
    .sort((a, b) =>
      (b.date ?? '').localeCompare(a.date ?? '')
      || compareVersions(b.version, a.version)
      || a.plugin.name.localeCompare(b.plugin.name));
}

/** The keywords most plugins share, in first-seen order among equals. */
export function topKeywords(catalog: Catalog, n: number): string[] {
  const counts = new Map<string, number>();
  for (const p of catalog.plugins) for (const k of p.keywords) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

/** Every plugin a plugin pulls in, directly or through its dependencies (catalog plugins only). */
export function transitiveDependencies(catalog: Catalog, name: string): string[] {
  const byName = new Map(catalog.plugins.map((p) => [p.name, p]));
  const seen = new Set<string>();
  const walk = (n: string) => {
    for (const d of byName.get(n)?.dependencies ?? []) {
      if (byName.has(d.name) && d.name !== name && !seen.has(d.name)) {
        seen.add(d.name);
        walk(d.name);
      }
    }
  };
  walk(name);
  return [...seen];
}

/** The plugin to install first: one nobody depends on that brings the most others with it. */
export function entryPlugin(catalog: Catalog): Plugin | null {
  const dependedOn = new Set(catalog.plugins.flatMap((p) => p.dependencies.map((d) => d.name)));
  const roots = catalog.plugins.filter((p) => !dependedOn.has(p.name));
  const pool = roots.length ? roots : catalog.plugins;
  let best: Plugin | null = null;
  let most = -1;
  for (const p of pool) {
    const n = transitiveDependencies(catalog, p.name).length;
    if (n > most) { best = p; most = n; }
  }
  return best;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export function allKeywords(catalog: Catalog): string[] {
  return [...new Set(catalog.plugins.flatMap((p) => p.keywords))];
}
