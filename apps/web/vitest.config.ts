import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    // Exclude Playwright e2e tests - they use their own test runner
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Cap fork workers to avoid resource exhaustion on Windows
    pool: 'forks',
    maxForks: 4,
  },
});
