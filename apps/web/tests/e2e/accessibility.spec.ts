import { test, expect, type Page } from '@playwright/test';

/**
 * Accessibility E2E tests.
 *
 * Covers skip-link behaviour, h1 presence on key pages, and focus-indicator
 * visibility. All tests mock Supabase auth and the engine so they run without
 * live credentials or a running backend.
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

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockEngineOffline(page);
  });

  test('skip to main content link works', async ({ page }) => {
    await page.goto('/');

    const skipLink = page.getByRole('link', { name: 'Skip to main content' });

    // First Tab keystroke should land on the skip link (it is the first
    // focusable element in the header — sr-only until focused).
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();

    // Once focused the link must be visually exposed (not sr-only)
    await expect(skipLink).toBeVisible();

    // The href must target the main landmark
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('all pages have h1 heading', async ({ page }) => {
    const routes: Array<{ path: string; heading: string }> = [
      { path: '/', heading: 'Dashboard' },
      { path: '/portfolio', heading: 'Portfolio' },
      { path: '/signals', heading: 'Signals' },
      { path: '/settings', heading: 'Settings' },
    ];

    for (const { path, heading } of routes) {
      await page.goto(path);

      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
      await expect(h1).toHaveText(heading);
    }
  });

  test('focus indicators are visible', async ({ page }) => {
    await page.goto('/');

    // Tab past the skip link to reach the first interactive shell element
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // next focusable element (header or sidebar)

    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();

    // Must be a natively interactive element so browsers apply default ring
    const tagName = await focused.evaluate((el) => el.tagName.toLowerCase());
    expect(['a', 'button', 'input', 'select', 'textarea']).toContain(tagName);
  });
});
