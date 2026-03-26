import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Sentinel/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('health endpoint returns OK', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('settings status endpoint accessible', async ({ request }) => {
    const response = await request.get('/api/settings/status');
    expect(response.status()).toBe(200);
  });
});
