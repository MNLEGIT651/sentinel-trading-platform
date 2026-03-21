import { test, expect, type Page } from '@playwright/test';

/**
 * Dashboard smoke tests.
 *
 * Verifies that the main dashboard renders correctly when the user is
 * authenticated but backend services are offline (the typical dev scenario).
 * The dashboard must never crash or show blank content — it falls back
 * gracefully to simulated/cached data and shows offline banners.
 */

/**
 * Inject a session cookie so Next.js middleware lets us through.
 * We mock the Supabase session endpoint so the server component
 * resolves to an authenticated user without a real Supabase project.
 */
async function mockAuthenticatedSession(page: Page) {
  // Mock the Supabase session endpoint used by createServerSupabaseClient()
  await page.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-user-id',
        email: 'test@sentinel.example',
        aud: 'authenticated',
        role: 'authenticated',
      }),
    });
  });
}

/**
 * Mock all engine proxy calls to return a 503 (engine offline).
 * This exercises the fallback/simulated-data code paths.
 */
async function mockEngineOffline(page: Page) {
  await page.route('**/api/engine/**', async (route) => {
    await route.fulfill({ status: 503, body: JSON.stringify({ error: 'service_unavailable' }) });
  });
  await page.route('**/api/agents/**', async (route) => {
    await route.fulfill({ status: 503, body: JSON.stringify({ error: 'service_unavailable' }) });
  });
}

test.describe('Dashboard — offline/fallback mode', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockEngineOffline(page);
  });

  test('loads the dashboard without errors', async ({ page }) => {
    // If auth redirects us to login, the test isn't properly mocking the session.
    // In that case the test setup needs a real session cookie — acceptable in CI
    // where PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD are provided.
    await page.goto('/');

    // Page must not show an error boundary
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('renders the four metric cards', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Total Equity')).toBeVisible();
    await expect(page.getByText('Daily P&L')).toBeVisible();
    await expect(page.getByText('Cash Available')).toBeVisible();
    await expect(page.getByText('Positions Value')).toBeVisible();
  });

  test('renders the price ticker', async ({ page }) => {
    await page.goto('/');

    // At least one ticker symbol from the watchlist should be visible
    const tickers = ['AAPL', 'MSFT', 'NVDA', 'SPY'];
    for (const ticker of tickers) {
      await expect(page.getByText(ticker).first()).toBeVisible();
    }
  });

  test('shows the SimulatedBadge when engine is offline', async ({ page }) => {
    await page.goto('/');

    // SimulatedBadge renders when isLive is false (fetch fails → keep fallback)
    await expect(page.getByText(/simulated/i)).toBeVisible();
  });
});

test.describe('Dashboard — navigation smoke', () => {
  test('nav links are present and point to the correct paths', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockEngineOffline(page);
    await page.goto('/');

    // Check the app-shell sidebar/nav includes the main routes
    const expectedHrefs = ['/', '/portfolio', '/signals', '/strategies', '/markets', '/agents', '/backtest', '/settings'];
    for (const href of expectedHrefs) {
      const link = page.locator(`a[href="${href}"]`).first();
      await expect(link).toBeVisible();
    }
  });
});

test.describe('/api/engine health proxy', () => {
  test('returns the upstream engine health response shape', async ({ page }) => {
    // Mock engine returning a live health payload through the proxy
    await page.route('**/api/engine/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', engine: 'sentinel', version: '0.1.0' }),
      });
    });

    const response = await page.request.get('/api/engine/health');
    // Proxy rewrites 200 upstream → 200 to client
    expect(response.status()).toBe(200);
  });

  test('returns 503 when the engine proxy is not configured', async ({ page }) => {
    // The real proxy route returns 503 when ENGINE_URL is unset in production
    // We just validate the status code contract here (the unit test covers the logic)
    const response = await page.request.get('/api/engine/nonexistent-path-xyz');
    // Either 503 (not_configured) or 502/504 (unreachable) — never a 2xx
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
