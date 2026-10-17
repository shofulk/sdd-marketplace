import type { Catalog, Plugin } from '../src/types';

export const DEFAULT_STABLE_PATH: string;

export interface BuildOptions {
  /** The repository root that holds .claude-plugin/marketplace.json. */
  root: string;
  /** The stable marketplace file, relative to root. */
  stablePath?: string;
  /** Defaults to GITHUB_SHA, then `git rev-parse HEAD`, then "local". */
  sha?: string;
  now?: Date;
}

export function buildCatalog(options: BuildOptions): Catalog;
export function excerpt(markdown: string): string;
export function parseChangelog(markdown: string): Plugin['changelog'];
export function normalizeList(value: unknown): string[];
