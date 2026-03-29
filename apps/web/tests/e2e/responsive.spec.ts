import { test, expect, type Page } from '@playwright/test';

/**
 * Responsive layout E2E tests.
 *
 * Verifies that the app shell adapts correctly between desktop and mobile
 * viewports. Uses mocked auth and an offline engine so no live services
 * are required.
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

test.describe('Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockEngineOffline(page);
  });

  test('desktop: sidebar is visible by default', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop-only test');
    await page.goto('/');

    // The desktop sidebar wrapper uses `hidden lg:block` — nav should be visible
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();

    // Hamburger button is `lg:hidden` — must not be visible on a wide viewport
    const hamburger = page.getByRole('button', { name: 'Toggle menu' });
    await expect(hamburger).not.toBeVisible();
  });

  test('mobile: sidebar is hidden by default', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    await page.goto('/');

    // Hamburger button should be present and interactive
    const hamburger = page.getByRole('button', { name: 'Toggle menu' });
    await expect(hamburger).toBeVisible();

    // Desktop sidebar nav is CSS-hidden (`hidden lg:block` wrapper); mobile
    // drawer hasn't been opened yet, so no nav should be visible.
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).not.toBeVisible();
  });

  test('metric cards grid adapts to viewport', async ({ page, isMobile }) => {
    await page.goto('/');

    // All four metric cards must be visible at every viewport
    const cardLabels = ['Total Equity', 'Daily P&L', 'Cash Available', 'Positions Value'];
    for (const label of cardLabels) {
      await expect(page.getByText(label)).toBeVisible();
    }

    // Verify relative layout: on mobile cards stack; on desktop they sit in a row
    const firstCard = page.getByText('Total Equity').first();
    const lastCard = page.getByText('Positions Value').first();

    const firstBox = await firstCard.boundingBox();
    const lastBox = await lastCard.boundingBox();

    expect(firstBox).not.toBeNull();
    expect(lastBox).not.toBeNull();

    if (isMobile) {
      // Cards stack vertically on narrow viewports
      expect(lastBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height / 2);
    } else {
      // Cards sit side-by-side in a grid row on wide viewports
      expect(Math.abs(lastBox!.y - firstBox!.y)).toBeLessThan(firstBox!.height);
    }
  });
});
