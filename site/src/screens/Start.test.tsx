import { fireEvent, render, screen, within } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CatalogApp } from '../App';
import { catalogFixture } from '../test/catalog.fixture';
import type { Catalog } from '../types';

function renderAt(hash: string, catalog: Catalog = catalogFixture) {
  window.location.hash = hash;
  return render(<HashRouter><CatalogApp catalog={catalog} /></HashRouter>);
}

describe('Start (getting started)', () => {
  const steps = () => within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
  const codeOf = (step: HTMLElement) => [...step.querySelectorAll('pre')].map((p) => p.textContent!);

  it('shows the five steps, each with its commands and a copy button', () => {
    renderAt('#/start');
    expect(screen.getByRole('heading', { level: 1, name: 'Connect the marketplace' })).toBeInTheDocument();
    expect(screen.getByText('Five steps from an empty project to a verified install.')).toBeInTheDocument();
    expect(steps()).toHaveLength(5);
    const code = steps().map(codeOf);
    expect(code[0]).toEqual(['/plugin marketplace add shofulk/sdd-marketplace', 'claude plugin marketplace add shofulk/sdd-marketplace']);
    expect(code[1]).toEqual(['/plugin install sdd-engineering@sdd', 'claude plugin install sdd-engineering@sdd --scope project']);
    // SDD-001: the stable channel is the `stable` branch under its own marketplace name
    expect(code[2][0]).toBe('claude plugin marketplace add shofulk/sdd-marketplace#stable');
    expect(code[2][1]).toBe('claude plugin install sdd-engineering@sdd-stable --scope project');
    // the settings `install --scope project` writes: the entry plugin and every dependency enabled
    expect(JSON.parse(code[2][2])).toEqual({
      extraKnownMarketplaces: {
        'sdd-stable': { source: { source: 'github', repo: 'shofulk/sdd-marketplace', ref: 'stable' } },
      },
      enabledPlugins: { 'sdd-engineering@sdd-stable': true, 'research-tools@sdd-stable': true },
    });
    expect(code[2].join('\n')).not.toContain('"path"');
    expect(code[4]).toEqual(['claude plugin list --json']);
    for (const s of steps()) expect(within(s).getAllByRole('button', { name: 'Copy' }).length).toBeGreaterThan(0);
  });

  // The rollback rehearsal (docs/releases/2026-10-19-rollback-rehearsal.md): no channel switch in
  // Claude Code; without prune -y the old channel's dependencies stay enabled.
  it('switches to latest and back to stable: uninstall, prune -y, install', () => {
    renderAt('#/start');
    const step = steps()[3];
    expect(within(step).getByRole('heading', { level: 3, name: 'Switch channels' })).toBeInTheDocument();
    expect(step).toHaveTextContent('without -y the old channel\u2019s dependencies stay enabled');
    expect(codeOf(step)).toEqual([
      [
        'claude plugin marketplace add shofulk/sdd-marketplace',
        'claude plugin uninstall sdd-engineering@sdd-stable --scope project',
        'claude plugin prune --scope project -y',
        'claude plugin install sdd-engineering@sdd --scope project',
      ].join('\n'),
      [
        'claude plugin uninstall sdd-engineering@sdd --scope project',
        'claude plugin prune --scope project -y',
        'claude plugin install sdd-engineering@sdd-stable --scope project',
      ].join('\n'),
    ]);
    expect(within(step).getAllByRole('button', { name: 'Copy' })).toHaveLength(2);
  });

  it('takes the stable branch and its marketplace name from the catalog', () => {
    renderAt('#/start', { ...catalogFixture, marketplace: { ...catalogFixture.marketplace, stable: { branch: 'pinned', name: 'sdd-pinned' } } });
    const [add, install, settings] = codeOf(steps()[2]);
    expect(add).toBe('claude plugin marketplace add shofulk/sdd-marketplace#pinned');
    expect(install).toBe('claude plugin install sdd-engineering@sdd-pinned --scope project');
    expect(JSON.parse(settings).extraKnownMarketplaces['sdd-pinned'].source.ref).toBe('pinned');
    expect(Object.keys(JSON.parse(settings).enabledPlugins)).toEqual(['sdd-engineering@sdd-pinned', 'research-tools@sdd-pinned']);
    expect(within(steps()[2]).getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
    expect(codeOf(steps()[3])[1]).toContain('claude plugin install sdd-engineering@sdd-pinned --scope project');
  });

  it('says there is no stable release yet and drops the channel switch when the catalog has no stable channel', () => {
    renderAt('#/start', { ...catalogFixture, marketplace: { ...catalogFixture.marketplace, stable: null } });
    expect(steps()).toHaveLength(4);
    expect(screen.getByText('Four steps from an empty project to a verified install.')).toBeInTheDocument();
    expect(steps()[2]).toHaveTextContent('No stable release yet: every plugin is on the latest channel.');
    expect(steps()[2].querySelector('pre')).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Switch channels' })).toBeNull();
  });

  it('names the entry plugin and how many plugins it brings', () => {
    renderAt('#/start');
    expect(screen.getByRole('heading', { level: 3, name: 'Install sdd-engineering' })).toBeInTheDocument();
    expect(screen.getByText(/^Its dependency installs with it\. From a shell, --scope project/)).toBeInTheDocument();
    expect(screen.getByText(/^Two plugins, enabled, no errors/)).toBeInTheDocument();
  });
});

describe('News (what’s new)', () => {
  it('lists every release, newest first, linking to the plugin', () => {
    renderAt('#/news');
    expect(screen.getByRole('heading', { level: 1, name: "What's new" })).toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'Releases' })).getAllByRole('button');
    expect(rows.map((r) => r.querySelector('.ver')!.textContent)).toEqual(['v1.1.0', 'v1.0.0']);
    fireEvent.click(rows[0]);
    expect(window.location.hash).toBe('#/plugin/sdd-engineering');
  });

  it('says so when nothing is released', () => {
    renderAt('#/news', { ...catalogFixture, plugins: catalogFixture.plugins.map((p) => ({ ...p, changelog: [] })) });
    expect(screen.getByText('No releases yet')).toBeInTheDocument();
  });
});
