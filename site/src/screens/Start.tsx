import { BackButton } from '../components/BackButton';
import { CopyButton } from '../components/CopyButton';
import { cap, entryPlugin, numberWord, transitiveDependencies } from '../lib/catalog';
import type { Catalog } from '../types';

// The stable channel's marketplace file (spec §3.8); build-catalog reads the same default.
const STABLE_PATH = '.claude-plugin/stable/marketplace.json';

function stableSnippet(name: string, repo: string): string {
  return [
    '{',
    '  "extraKnownMarketplaces": {',
    `    "${name}-stable": {`,
    `      "source": { "source": "github", "repo": "${repo}",`,
    `                  "path": "${STABLE_PATH}" }`,
    '    }',
    '  }',
    '}',
  ].join('\n');
}

export function Start({ catalog }: { catalog: Catalog }) {
  const repo = catalog.marketplace.repo ?? '<owner>/<repo>';
  const market = catalog.marketplace.name;
  const entry = entryPlugin(catalog);
  const deps = entry ? transitiveDependencies(catalog, entry.name).length : 0;
  const entryName = entry?.name ?? '<plugin>';
  const brings =
    deps === 0 ? 'It has no dependencies.'
      : deps === 1 ? 'Its dependency installs with it.'
        : `Its ${numberWord(deps)} dependencies install with it.`;

  const steps = [
    { title: 'Add the marketplace', text: 'The latest channel: the main marketplace file, with relative paths.', code: `/plugin marketplace add ${repo}` },
    { title: `Install ${entryName}`, text: brings, code: `/plugin install ${entryName}@${market}` },
    { title: 'Or pin stable', text: 'A second marketplace file pins the release tags.', code: stableSnippet(market, repo) },
    {
      title: 'Verify',
      text: `${cap(numberWord(deps + 1))} ${deps ? 'plugins' : 'plugin'}, enabled, no errors; the same versions as in .sdd/trace.jsonl.`,
      code: 'claude plugin list --json',
    },
  ];

  return (
    <main className="w-plugin">
      <BackButton />
      <h1 className="page-title">Connect the marketplace</h1>
      <p className="p-desc lead">Four steps from an empty project to a verified install.</p>
      <ol className="steps" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s.title} className="step">
            <div className="n num" aria-hidden="true">{i + 1}</div>
            <div className="txt">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <div className="code-row">
                <pre className="code">{s.code}</pre>
                <CopyButton text={s.code} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
