import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

const hasDom = typeof window !== 'undefined';

// jsdom has no layout: scrolling is a no-op here, not an error.
if (hasDom) window.scrollTo = () => {};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  if (!hasDom) return;
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  window.location.hash = '';
});
