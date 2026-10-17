import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { catalogFixture } from './test/catalog.fixture';

function stubFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('App catalog loading', () => {
  it('renders the home heading once catalog.json has loaded', async () => {
    const fetchMock = stubFetch(async () => new Response(JSON.stringify(catalogFixture), { status: 200 }));
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /Spec Driven Development/ })).toBeInTheDocument();
    // Vitest serves at base '/', so BASE_URL is '/' here; the build's '/sdd-marketplace/' is checked on dist (A8).
    expect(fetchMock).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}catalog.json`);
  });

  it('shows the load error when fetch rejects', async () => {
    stubFetch(async () => { throw new TypeError('Failed to fetch'); });
    render(<App />);
    expect(await screen.findByText('The catalog could not be loaded')).toBeInTheDocument();
  });

  it('shows the load error when catalog.json is not valid JSON', async () => {
    stubFetch(async () => new Response('<!doctype html><p>not json', { status: 200 }));
    render(<App />);
    expect(await screen.findByText('The catalog could not be loaded')).toBeInTheDocument();
  });

  it('shows the load error when catalog.json is missing (404)', async () => {
    stubFetch(async () => new Response('Not Found', { status: 404 }));
    render(<App />);
    expect(await screen.findByText('The catalog could not be loaded')).toBeInTheDocument();
    expect(screen.getByText(/HTTP 404/)).toBeInTheDocument();
  });
});
