import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the project page under /sdd-marketplace/ and has no single-page fallback,
// so the app uses a HashRouter and every asset URL carries this base (spec §3.8).
export default defineConfig({
  base: '/sdd-marketplace/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.ts'],
  },
});
