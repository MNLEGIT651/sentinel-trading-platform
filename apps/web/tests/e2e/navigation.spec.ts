import { test, expect, type Page } from '@playwright/test';

/**
 * Navigation E2E tests.
 *
 * Covers sidebar rendering, mobile hamburger drawer, page headings, and
 * keyboard navigation. All tests mock Supabase auth and the engine so they
 * run without live credentials or a running backend.
 */

async function mockAuthenticatedSession(page: Page) {
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

async function mockEngineOffline(page: Page) {
  await page.route('**/api/engine/**', async (route) => {
    await route.fulfill({ status: 503, body: JSON.stringify({ error: 'service_unavailable' }) });
  });
  await page.route('**/api/agents/**', async (route) => {
    await route.fulfill({ status: 503, body: JSON.stringify({ error: 'service_unavailable' }) });
  });
}

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockEngineOffline(page);
  });

  test('sidebar navigation renders all menu items', async ({ page }) => {
    await page.goto('/');

    // Core nav links that must always be present
    const expectedHrefs = [
      '/',
      '/markets',
      '/strategies',
      '/signals',
      '/portfolio',
      '/agents',
      '/backtest',
      '/settings',
    ];

    // On desktop the nav is inside the static sidebar; on mobile we open it first
    const hamburger = page.getByRole('button', { name: 'Toggle menu' });
    if (await hamburger.isVisible()) {
      await hamburger.click();
    }

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();

    for (const href of expectedHrefs) {
      await expect(nav.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
  });

  test('mobile: hamburger menu opens sidebar drawer', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    await page.goto('/');

    const hamburger = page.getByRole('button', { name: 'Toggle menu' });
    await expect(hamburger).toBeVisible();

    // Desktop nav is CSS-hidden on mobile; mobile drawer not yet rendered
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).not.toBeVisible();

    await hamburger.click();

    // Mobile drawer injects a fresh Sidebar — nav should now be visible
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });

  test('page titles render correctly', async ({ page }) => {
    const routes: Array<{ path: string; heading: string }> = [
      { path: '/', heading: 'Dashboard' },
      { path: '/portfolio', heading: 'Portfolio' },
      { path: '/agents', heading: 'AI Agents' },
      { path: '/settings', heading: 'Settings' },
    ];

    for (const { path, heading } of routes) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
  });

  test('keyboard navigation: Tab through sidebar links', async ({ page }) => {
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    // On mobile the nav is hidden until the drawer opens — skip focus check
    const navVisible = await nav.isVisible();
    if (!navVisible) {
      test.skip(true, 'Sidebar nav not visible at this viewport');
    }

    const firstNavLink = nav.getByRole('link').first();
    const secondNavLink = nav.getByRole('link').nth(1);

    // Programmatically focus the first link and verify Tab moves to the next
    await firstNavLink.focus();
    await expect(firstNavLink).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(secondNavLink).toBeFocused();
  });
});
