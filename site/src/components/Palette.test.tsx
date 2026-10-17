import { fireEvent, render, screen, within } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CatalogApp } from '../App';
import { catalogFixture } from '../test/catalog.fixture';

function renderHome() {
  window.location.hash = '#/';
  return render(<HashRouter><CatalogApp catalog={catalogFixture} /></HashRouter>);
}
const dialog = () => screen.queryByRole('dialog', { name: 'Quick open' });
const input = () => within(dialog()!).getByRole('combobox');
const options = () => within(dialog()!).getAllByRole('option').map((o) => o.querySelector('.grow')!.textContent);

describe('Palette', () => {
  it('opens on ⌘K, filters as you type, and opens the chosen item on Enter', () => {
    renderHome();
    expect(dialog()).toBeNull();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(dialog()).toBeInTheDocument();
    expect(input()).toHaveFocus();
    fireEvent.change(input(), { target: { value: 'verifier' } });
    expect(options()).toEqual(['plan-verifier']);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(window.location.hash).toBe('#/plugin/sdd-engineering/agent/plan-verifier');
    expect(dialog()).toBeNull();
  });

  it('opens on Ctrl+K and closes on Escape', () => {
    renderHome();
    fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
    expect(dialog()).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog()).toBeNull();
  });

  it('moves the selection with the arrow keys', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Quick open' }));
    expect(options()).toHaveLength(9);
    expect(within(dialog()!).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(window.location.hash).toBe('#/plugin/sdd-engineering/skill/run-plan');
  });

  it('says Nothing found for a query nothing matches', () => {
    renderHome();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    fireEvent.change(input(), { target: { value: 'zzzz' } });
    expect(within(dialog()!).getByText('Nothing found')).toBeInTheDocument();
  });
});

describe('Theme', () => {
  it('flips data-theme on <html> between light and dark', () => {
    renderHome();
    const toggle = screen.getByRole('button', { name: 'Toggle theme' });
    fireEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(toggle).toHaveTextContent('☀');
    fireEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(toggle).toHaveTextContent('☾');
  });
});

describe('Footer', () => {
  it('shows the build commit and time, and the totals', () => {
    renderHome();
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('build abc1234 · 2026-10-17 18:30 UTC');
    expect(within(footer).getByRole('link', { name: 'abc1234' }))
      .toHaveAttribute('href', 'https://github.com/shofulk/sdd-marketplace/commit/abc1234def5678');
    expect(footer).toHaveTextContent('2 plugins · 7 components');
    expect(within(footer).getByRole('link', { name: 'Connect the marketplace' })).toHaveAttribute('href', '#/start');
  });
});
