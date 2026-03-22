import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Sentinel Trading Platform E2E tests.
 *
 * Tests run against a locally started Next.js dev server so they don't
 * require any deployed infrastructure. Supabase auth is mocked at the
 * network level — no real credentials needed for the smoke suite.
 *
 * CI: `pnpm --filter web test:e2e`
 * Local: `pnpm --filter web exec playwright test --ui`
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source */
  forbidOnly: !!process.env.CI,
  /* Retry once on CI to absorb transient flakiness */
  retries: process.env.CI ? 1 : 0,
  /* Limit parallelism in CI to avoid resource contention */
  workers: process.env.CI ? 2 : '50%',
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: BASE_URL,
    /* Capture screenshots and traces on first retry to aid debugging */
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    /* Shorter timeout for CI where start-up is fresh */
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the Next.js dev server automatically if not already running */
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
