import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogApp } from '../App';
import { CopyButton } from '../components/CopyButton';
import { catalogFixture } from '../test/catalog.fixture';

function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<HashRouter><CatalogApp catalog={catalogFixture} /></HashRouter>);
}
const results = () => screen.getByRole('list', { name: 'Results' });
const cardNames = () => within(results()).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(writeText) }, configurable: true });
}
afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
  vi.useRealTimers();
});

describe('Search', () => {
  it('shows the whole catalog without a query', () => {
    renderAt('#/search');
    expect(screen.getByRole('heading', { level: 1, name: 'The whole catalog' })).toBeInTheDocument();
    expect(screen.getByText('9 results')).toBeInTheDocument();
  });

  it('takes the query from ?q=', () => {
    renderAt('#/search?q=verifier');
    expect(screen.getByRole('heading', { level: 1, name: 'Results for "verifier"' })).toBeInTheDocument();
    expect(cardNames()).toEqual(['plan-verifier']);
  });

  it('filters by kind', () => {
    renderAt('#/search');
    // the Type facet ("agents" + its count), not the keyword chip "agents"
    fireEvent.click(screen.getByRole('button', { name: /^agents\s*3$/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Agents' })).toBeInTheDocument();
    expect(cardNames().sort()).toEqual(['implementer', 'plan-verifier', 'researcher']);
  });

  it('filters by keyword', () => {
    renderAt('#/search');
    fireEvent.click(screen.getByRole('button', { name: 'research', pressed: false }));
    expect(cardNames()).toEqual(['Research Tools', 'researcher']);
  });

  it('sorts by name', () => {
    renderAt('#/search');
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } });
    const names = cardNames();
    expect(names).toEqual([...names].sort((a, b) => a!.localeCompare(b!)));
    expect(names[0]).toBe('bash-guard');
  });

  it('starts with the kind the home screen picked', () => {
    renderAt('#/');
    fireEvent.click(screen.getByRole('button', { name: '2 hooks' }));
    expect(window.location.hash).toBe('#/search');
    expect(cardNames().sort()).toEqual(['bash-guard', 'trace']);
  });

  it('says Nothing found and resets the filters', () => {
    renderAt('#/search?q=zzzz');
    expect(screen.getByRole('heading', { name: 'Nothing found' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(window.location.hash).toBe('#/search');
    expect(screen.getByText('9 results')).toBeInTheDocument();
  });

  it('opens a component from its card', () => {
    renderAt('#/search?q=implementer');
    fireEvent.click(within(results()).getByRole('link', { name: 'Open' }));
    expect(window.location.hash).toBe('#/plugin/sdd-engineering/agent/implementer');
  });
});

describe('CopyButton', () => {
  it('shows ✓ Copied when the clipboard accepts the text', async () => {
    stubClipboard(async () => {});
    render(<CopyButton text="/plugin install sdd-engineering@sdd" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/plugin install sdd-engineering@sdd');
    expect(screen.getByRole('button', { name: '✓ Copied' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Copied: /plugin install sdd-engineering@sdd');
  });

  it('asks to select the text by hand when the clipboard rejects', async () => {
    stubClipboard(async () => { throw new DOMException('denied', 'NotAllowedError'); });
    render(<CopyButton text="claude plugin list --json" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(screen.getByRole('status')).toHaveTextContent('The browser blocked copying. Select the text by hand');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('asks to select the text by hand when there is no clipboard API', async () => {
    render(<CopyButton text="x" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(screen.getByRole('status')).toHaveTextContent('The browser blocked copying. Select the text by hand');
  });

  it('goes back to Copy after a moment', async () => {
    vi.useFakeTimers();
    stubClipboard(async () => {});
    render(<CopyButton text="x" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(screen.getByRole('button', { name: '✓ Copied' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
