import { render, screen } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CatalogApp } from '../App';
import { catalogFixture } from '../test/catalog.fixture';

function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<HashRouter><CatalogApp catalog={catalogFixture} /></HashRouter>);
}

describe('NotFound', () => {
  it.each([
    ['an unknown plugin', '#/plugin/nope'],
    ['an unknown component of a real plugin', '#/plugin/sdd-engineering/agent/nope'],
    ['a component under the wrong kind', '#/plugin/sdd-engineering/skill/implementer'],
    ['an unknown route', '#/nowhere'],
  ])('renders Not found with a link home for %s', (_label, hash) => {
    renderAt(hash);
    expect(screen.getByRole('heading', { level: 1, name: 'Not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the catalog' })).toHaveAttribute('href', '#/');
  });
});
