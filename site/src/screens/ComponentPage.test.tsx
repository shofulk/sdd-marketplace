import { render, screen, within } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CatalogApp } from '../App';
import { catalogFixture } from '../test/catalog.fixture';

function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<HashRouter><CatalogApp catalog={catalogFixture} /></HashRouter>);
}
const facts = () => screen.getByRole('list', { name: 'Facts' });
const fact = (name: string) => within(facts()).queryByRole('listitem', { name });

describe('ComponentPage', () => {
  it('shows breadcrumbs, the kind badge and the invocation chip', () => {
    renderAt('#/plugin/sdd-engineering/agent/implementer');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumbs' });
    expect(crumbs).toHaveTextContent('Catalog / SDD Engineering / implementer');
    expect(within(crumbs).getByRole('link', { name: 'Catalog' })).toHaveAttribute('href', '#/search');
    expect(within(crumbs).getByRole('link', { name: 'SDD Engineering' })).toHaveAttribute('href', '#/plugin/sdd-engineering');
    expect(screen.getByRole('heading', { level: 1, name: 'implementer' })).toBeInTheDocument();
    expect(document.querySelector('.a-title .kind')).toHaveTextContent('agent'); // the title's badge, not More's
    expect(screen.getByText('@agent-sdd-engineering:implementer')).toBeInTheDocument();
    expect(screen.getByText('Implements an approved plan step by step.')).toBeInTheDocument();
  });

  it('shows Tools, Model and Preloaded skills for an agent, and no Event', () => {
    renderAt('#/plugin/sdd-engineering/agent/implementer');
    expect(fact('Tools')).toHaveTextContent('ReadEditBash');
    expect(fact('Model')).toHaveTextContent('sonnet');
    expect(fact('Preloaded skills')).toHaveTextContent('onion-architecture');
    expect(fact('Event')).toBeNull();
    expect(fact('Plugin')).toHaveTextContent('sdd-engineering v1.1.0');
  });

  it('shows the Event for a hook, and no Tools, Model, skills or invocation', () => {
    renderAt('#/plugin/sdd-engineering/hook/trace');
    expect(fact('Event')).toHaveTextContent('SessionStart');
    expect(fact('Tools')).toBeNull();
    expect(fact('Model')).toBeNull();
    expect(fact('Preloaded skills')).toBeNull();
    expect(document.querySelector('.inv-chip')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Documentation' })).getByText('No documentation')).toBeInTheDocument();
  });

  it('shows no invocation chip for a skill that is not user-invocable', () => {
    renderAt('#/plugin/sdd-engineering/skill/spec-writing');
    expect(document.querySelector('.inv-chip')).toBeNull();
  });

  it('renders the excerpt under Documentation', () => {
    renderAt('#/plugin/sdd-engineering/agent/implementer');
    const doc = screen.getByRole('region', { name: 'Documentation' });
    const paragraphs = within(doc).getAllByText(/./, { selector: 'p' }).map((p) => p.textContent);
    expect(paragraphs).toEqual(['It gets its lane brief, not the whole plan.', 'It does not commit or push.']);
  });

  it('links up to four more components of the plugin', () => {
    renderAt('#/plugin/sdd-engineering/agent/implementer');
    const more = screen.getByRole('region', { name: 'More in this plugin' });
    const links = within(more).getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links.map((a) => a.textContent)).not.toContain(expect.stringContaining('implementer'));
    expect(links[0]).toHaveAttribute('href', '#/plugin/sdd-engineering/skill/run-plan');
  });

  it('has no More section when the plugin has one component', () => {
    renderAt('#/plugin/research-tools/agent/researcher');
    expect(screen.queryByRole('region', { name: 'More in this plugin' })).toBeNull();
  });
});
