// The catalog contract: site/scripts/build-catalog.mjs writes public/catalog.json in this shape,
// and the app reads every fact it shows from it.

export type Kind = 'skill' | 'agent' | 'hook';

export interface Catalog {
  marketplace: { name: string; owner: string; description: string; repo: string | null }; // repo "owner/name"
  build: { sha: string; builtAt: string }; // ISO time
  plugins: Plugin[];
  warnings: string[];
}

export interface Plugin {
  name: string;
  displayName: string;
  description: string;
  author: string;
  keywords: string[];
  version: string; // plugin.json version = latest
  stableVersion: string | null; // from the stable file's ref; null = not released
  dependencies: { name: string; range: string | null }[];
  readme: string | null; // Markdown
  changelog: { version: string; date: string | null; summary: string }[]; // newest first, no Unreleased
  components: Component[];
  path: string; // "plugins/<name>"
}

export interface Component {
  kind: Kind;
  name: string;
  description: string;
  invocation: string | null; // skill "/<plugin>:<name>" unless user-invocable false; agent "@agent-<plugin>:<name>"; hook null
  tools: string[];
  model: string | null;
  skills: string[];
  events: string[]; // hooks: event names from hooks.json; others []
  excerpt: string; // first two non-heading paragraphs of the Markdown body
  path: string;
}
