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
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/e2e/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 55,
        lines: 60,
      },
    },
  },
});
