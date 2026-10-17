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
  it('shows the four steps, each with its command and a copy button', () => {
    renderAt('#/start');
    expect(screen.getByRole('heading', { level: 1, name: 'Connect the marketplace' })).toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    const code = steps.map((s) => [...s.querySelectorAll('pre')].map((p) => p.textContent!));
    expect(code[0]).toEqual(['/plugin marketplace add shofulk/sdd-marketplace']);
    expect(code[1]).toEqual(['/plugin install sdd-engineering@sdd']);
    // SDD-001: the stable channel is the `stable` branch under its own marketplace name
    expect(code[2][0]).toBe('claude plugin marketplace add shofulk/sdd-marketplace#stable');
    expect(code[2][1]).toBe('/plugin install sdd-engineering@sdd-stable');
    expect(JSON.parse(code[2][2])).toEqual({
      extraKnownMarketplaces: {
        'sdd-stable': { source: { source: 'github', repo: 'shofulk/sdd-marketplace', ref: 'stable' } },
      },
    });
    expect(code[2].join('\n')).not.toContain('"path"');
    expect(code[3]).toEqual(['claude plugin list --json']);
    for (const s of steps) expect(within(s).getAllByRole('button', { name: 'Copy' }).length).toBeGreaterThan(0);
  });

  it('takes the stable branch and its marketplace name from the catalog', () => {
    renderAt('#/start', { ...catalogFixture, marketplace: { ...catalogFixture.marketplace, stable: { branch: 'pinned', name: 'sdd-pinned' } } });
    const step = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')[2];
    const [add, install, settings] = [...step.querySelectorAll('pre')].map((p) => p.textContent!);
    expect(add).toBe('claude plugin marketplace add shofulk/sdd-marketplace#pinned');
    expect(install).toBe('/plugin install sdd-engineering@sdd-pinned');
    expect(JSON.parse(settings).extraKnownMarketplaces['sdd-pinned'].source.ref).toBe('pinned');
    expect(within(step).getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
  });

  it('says there is no stable release yet when the catalog has no stable channel', () => {
    renderAt('#/start', { ...catalogFixture, marketplace: { ...catalogFixture.marketplace, stable: null } });
    const step = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')[2];
    expect(step).toHaveTextContent('No stable release yet: every plugin is on the latest channel.');
    expect(step.querySelector('pre')).toBeNull();
  });

  it('names the entry plugin and how many plugins it brings', () => {
    renderAt('#/start');
    expect(screen.getByRole('heading', { level: 3, name: 'Install sdd-engineering' })).toBeInTheDocument();
    expect(screen.getByText('Its dependency installs with it.')).toBeInTheDocument();
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
