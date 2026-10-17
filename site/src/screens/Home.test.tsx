import { fireEvent, render, screen, within } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CatalogApp } from '../App';
import { catalogFixture } from '../test/catalog.fixture';

function renderHome() {
  window.location.hash = '#/';
  return render(<HashRouter><CatalogApp catalog={catalogFixture} /></HashRouter>);
}

describe('Home', () => {
  it('shows the counts per kind from the catalog', () => {
    renderHome();
    const stats = screen.getByRole('region', { name: 'Counts by type' });
    for (const label of ['2 plugins', '2 skills', '3 agents', '2 hooks']) {
      expect(within(stats).getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('lists the newest changelog entries under What’s new', () => {
    renderHome();
    const news = screen.getByRole('region', { name: "What's new" });
    const rows = within(news).getAllByRole('button');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('v1.1.0');
    expect(rows[0]).toHaveTextContent('Blocks git push to the default branch.');
    expect(rows[0]).toHaveTextContent('2026-10-20');
    expect(rows[1]).toHaveTextContent('v1.0.0');
  });

  it('draws a graph node per plugin and opens the plugin on click', () => {
    renderHome();
    const graph = screen.getByRole('group', { name: /Dependency graph/ });
    expect(within(graph).getByRole('button', { name: 'Open sdd-engineering' })).toBeInTheDocument();
    fireEvent.click(within(graph).getByRole('button', { name: 'Open research-tools' }));
    expect(window.location.hash).toBe('#/plugin/research-tools');
  });

  it('offers the catalog keywords as chips', () => {
    renderHome();
    expect(screen.getByRole('button', { name: '#sdd' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#research' })).toBeInTheDocument();
  });

  it('searches on Enter in the hero box', () => {
    renderHome();
    const box = screen.getByRole('searchbox', { name: 'Describe what you need' });
    fireEvent.change(box, { target: { value: 'plan verifier' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(window.location.hash).toBe('#/search?q=plan%20verifier');
  });
});

describe('Header', () => {
  it('links home, to Connect and to the repository on GitHub', () => {
    renderHome();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'GitHub ↗' })).toHaveAttribute('href', 'https://github.com/shofulk/sdd-marketplace');
    expect(within(header).getByRole('link', { name: 'Connect' })).toHaveAttribute('href', '#/start');
    expect(within(header).getByText('sdd')).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Quick open' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });

  it('hides the GitHub link when the catalog knows no repository', () => {
    window.location.hash = '#/';
    render(<HashRouter><CatalogApp catalog={{ ...catalogFixture, marketplace: { ...catalogFixture.marketplace, repo: null } }} /></HashRouter>);
    expect(screen.queryByRole('link', { name: 'GitHub ↗' })).not.toBeInTheDocument();
  });
});
