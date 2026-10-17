import type { Catalog, Plugin } from '../src/types';

/** The branch that is the stable channel (findings SDD-001). */
export const STABLE_BRANCH: string;

export interface BuildOptions {
  /** The repository root that holds .claude-plugin/marketplace.json; the stable branch is read only when it is the git root. */
  root: string;
  /** Defaults to GITHUB_SHA, then `git rev-parse HEAD`, then "local". */
  sha?: string;
  now?: Date;
}

export function buildCatalog(options: BuildOptions): Catalog;
export function excerpt(markdown: string): string;
export function parseChangelog(markdown: string): Plugin['changelog'];
export function normalizeList(value: unknown): string[];
