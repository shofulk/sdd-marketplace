import { BackButton } from '../components/BackButton';
import { CopyButton } from '../components/CopyButton';
import { cap, entryPlugin, numberWord, transitiveDependencies } from '../lib/catalog';
import type { Catalog } from '../types';

// The stable channel is a branch with its own marketplace name (findings SDD-001). The settings are
// the ones `claude plugin install --scope project` writes: the entry plugin and every dependency.
function stableSnippet(name: string, repo: string, branch: string, plugins: string[]): string {
  return [
    '{',
    '  "extraKnownMarketplaces": {',
    `    "${name}": {`,
    `      "source": { "source": "github", "repo": "${repo}", "ref": "${branch}" }`,
    '    }',
    '  },',
    '  "enabledPlugins": {',
    plugins.map((p) => `    "${p}@${name}": true`).join(',\n'),
    '  }',
    '}',
  ].join('\n');
}

// Claude Code has no channel switch: uninstall, prune the old channel's dependencies, install
// (docs/releases/2026-10-19-rollback-rehearsal.md).
function switchTo(entry: string, from: string, to: string): string {
  return [
    `claude plugin uninstall ${entry}@${from} --scope project`,
    'claude plugin prune --scope project -y',
    `claude plugin install ${entry}@${to} --scope project`,
  ].join('\n');
}

function CodeRow({ code }: { code: string }) {
  return (
    <div className="code-row">
      <pre className="code">{code}</pre>
      <CopyButton text={code} />
    </div>
  );
}

export function Start({ catalog }: { catalog: Catalog }) {
  const repo = catalog.marketplace.repo ?? '<owner>/<repo>';
  const market = catalog.marketplace.name;
  const stable = catalog.marketplace.stable ?? null; // an older catalog.json has no stable field
  const entry = entryPlugin(catalog);
  const depNames = entry ? transitiveDependencies(catalog, entry.name) : [];
  const deps = depNames.length;
  const entryName = entry?.name ?? '<plugin>';
  const brings =
    deps === 0 ? 'It has no dependencies.'
      : deps === 1 ? 'Its dependency installs with it.'
        : `Its ${numberWord(deps)} dependencies install with it.`;

  const steps = [
    {
      title: 'Add the marketplace',
      text: 'The latest channel: the main marketplace file, with relative paths. In a session, or from a shell.',
      code: [`/plugin marketplace add ${repo}`, `claude plugin marketplace add ${repo}`],
    },
    {
      title: `Install ${entryName}`,
      text: `${brings} From a shell, --scope project records it in the project's .claude/settings.json.`,
      code: [`/plugin install ${entryName}@${market}`, `claude plugin install ${entryName}@${market} --scope project`],
    },
    stable
      ? {
        title: 'Or pin stable',
        text: `The ${stable.branch} branch holds the released versions as the marketplace ${stable.name}. Add it and install from it; the install writes these project settings.`,
        code: [
          `claude plugin marketplace add ${repo}#${stable.branch}`,
          `claude plugin install ${entryName}@${stable.name} --scope project`,
          stableSnippet(stable.name, repo, stable.branch, [entryName, ...depNames]),
        ],
      }
      : { title: 'Or pin stable', text: 'No stable release yet: every plugin is on the latest channel.', code: [] },
    ...(stable
      ? [{
        title: 'Switch channels',
        text: 'There is no channel switch or downgrade command: uninstall, prune, install from the other marketplace. To latest, then back to stable; without -y the old channel’s dependencies stay enabled.',
        code: [
          [`claude plugin marketplace add ${repo}`, switchTo(entryName, stable.name, market)].join('\n'),
          switchTo(entryName, market, stable.name),
        ],
      }]
      : []),
    {
      title: 'Verify',
      text: `${cap(numberWord(deps + 1))} ${deps ? 'plugins' : 'plugin'}, enabled, no errors; the same versions as in .sdd/trace.jsonl.`,
      code: ['claude plugin list --json'],
    },
  ];

  return (
    <main className="w-plugin">
      <BackButton />
      <h1 className="page-title">Connect the marketplace</h1>
      <p className="p-desc lead">{cap(numberWord(steps.length))} steps from an empty project to a verified install.</p>
      <ol className="steps" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s.title} className="step">
            <div className="n num" aria-hidden="true">{i + 1}</div>
            <div className="txt">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <div className="code-rows">
                {s.code.map((c) => <CodeRow key={c} code={c} />)}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
