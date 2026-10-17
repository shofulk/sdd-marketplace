import { fireEvent, render, screen, within } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CatalogApp } from '../App';
import { catalogFixture } from '../test/catalog.fixture';
import type { Catalog, Plugin } from '../types';

function renderAt(hash: string, catalog: Catalog = catalogFixture) {
  window.location.hash = hash;
  return render(<HashRouter><CatalogApp catalog={catalog} /></HashRouter>);
}
function withPlugin(name: string, patch: Partial<Plugin>): Catalog {
  return { ...catalogFixture, plugins: catalogFixture.plugins.map((p) => (p.name === name ? { ...p, ...patch } : p)) };
}
const section = (name: string) => screen.getByRole('region', { name });

describe('PluginPage', () => {
  it('shows the display name, the latest and the stable version', () => {
    renderAt('#/plugin/sdd-engineering');
    expect(screen.getByRole('heading', { level: 1, name: 'SDD Engineering' })).toBeInTheDocument();
    expect(screen.getByText('latest 1.1.0')).toBeInTheDocument();
    expect(screen.getByText('stable 1.0.0')).toBeInTheDocument();
    expect(screen.getByText('sdd-engineering · shofulk · 6 components')).toBeInTheDocument();
  });

  it('says stable: not released when the stable file pins no version', () => {
    renderAt('#/plugin/research-tools');
    expect(screen.getByText('latest 1.0.0')).toBeInTheDocument();
    expect(screen.getByText('stable: not released')).toBeInTheDocument();
  });

  it('shows the install command with a copy button and the GitHub link', () => {
    renderAt('#/plugin/sdd-engineering');
    expect(screen.getByText('/plugin install sdd-engineering@sdd')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy' }).length).toBeGreaterThan(0);
    const links = screen.getAllByRole('link', { name: 'GitHub ↗' }).map((a) => a.getAttribute('href'));
    expect(links).toContain('https://github.com/shofulk/sdd-marketplace/tree/main/plugins/sdd-engineering');
  });

  it('groups the components by kind with their invocation', () => {
    renderAt('#/plugin/sdd-engineering');
    const comp = section('Composition');
    const skills = within(comp).getByRole('group', { name: 'skills' });
    expect(within(skills).getByRole('link', { name: /run-plan/ })).toHaveTextContent('/sdd-engineering:run-plan');
    expect(within(skills).getByRole('link', { name: /spec-writing/ })).toHaveAttribute('href', '#/plugin/sdd-engineering/skill/spec-writing');
    const agents = within(comp).getByRole('group', { name: 'agents' });
    expect(within(agents).getByRole('link', { name: /implementer/ })).toHaveTextContent('@agent-sdd-engineering:implementer');
    const hooks = within(comp).getByRole('group', { name: 'hooks' });
    expect(within(hooks).getByRole('link', { name: /trace/ })).toHaveTextContent('SessionStart');
  });

  it('links its dependencies and the plugins that depend on it', () => {
    renderAt('#/plugin/sdd-engineering');
    const dep = within(section('Dependencies')).getByRole('link', { name: /research-tools/ });
    expect(dep).toHaveTextContent('^1.0.0');
    fireEvent.click(dep);
    expect(window.location.hash).toBe('#/plugin/research-tools');
    expect(within(section('Dependencies')).getByText(/Depended on by/)).toBeInTheDocument();
    expect(within(section('Dependencies')).getByRole('link', { name: 'sdd-engineering' })).toHaveAttribute('href', '#/plugin/sdd-engineering');
  });

  it('renders the README from Markdown, without raw HTML', () => {
    renderAt('#/plugin/sdd-engineering', withPlugin('sdd-engineering', {
      readme: '# SDD Engineering\n\nTakes a feature from **request** to a verified change.\n\n- spec\n- plan\n\n<b>raw</b>\n\nSee [the guide](docs/guide.md).\n',
    }));
    const readme = section('README');
    expect(within(readme).getByText('request').tagName).toBe('STRONG');
    expect(within(readme).getAllByRole('listitem')).toHaveLength(2);
    expect(readme.querySelector('b')).toBeNull();
    expect(within(readme).getByRole('link', { name: 'the guide' }))
      .toHaveAttribute('href', 'https://github.com/shofulk/sdd-marketplace/blob/main/plugins/sdd-engineering/docs/guide.md');
  });

  it('lists the changelog with the stable and latest marks', () => {
    renderAt('#/plugin/sdd-engineering');
    const entries = within(section('Changelog')).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('v1.1.0');
    expect(entries[0]).toHaveTextContent('2026-10-20');
    expect(entries[0]).toHaveTextContent('latest');
    expect(entries[0]).toHaveTextContent('Blocks git push to the default branch.');
    expect(entries[1]).toHaveTextContent('v1.0.0');
    expect(entries[1]).toHaveTextContent('stable');
  });

  it('shows empty states for a plugin with no README, no CHANGELOG and no components', () => {
    renderAt('#/plugin/research-tools', withPlugin('research-tools', { components: [] }));
    expect(within(section('README')).getByText('No README')).toBeInTheDocument();
    expect(within(section('Changelog')).getByText('No releases yet')).toBeInTheDocument();
    expect(within(section('Composition')).getByText('No components')).toBeInTheDocument();
  });
});
