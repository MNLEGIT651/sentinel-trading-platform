import { test, expect } from '@playwright/test';

/**
 * Auth flow smoke tests.
 *
 * These tests verify the shape and behavior of the auth UI without
 * performing real Supabase sign-ins. They rely solely on DOM assertions
 * and form-level validation — no test account credentials required.
 *
 * For authenticated-flow E2E tests, see the `authenticated/` sub-suite
 * which requires PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD env vars.
 */

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the sign-in form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign in to sentinel/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows a link to the sign-up page', async ({ page }) => {
    const signUpLink = page.getByRole('link', { name: /sign up/i });
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute('href', '/signup');
  });

  test('submit button is enabled when fields are filled', async ({ page }) => {
    const button = page.getByRole('button', { name: /sign in/i });
    // Initially enabled (HTML5 required handles browser-level blocking)
    await expect(button).not.toBeDisabled();

    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'hunter2');
    await expect(button).not.toBeDisabled();
  });

  test('shows "Signing in…" while the request is in flight', async ({ page }) => {
    // Intercept the Supabase auth endpoint so the request never resolves
    await page.route('**/auth/v1/token**', async (route) => {
      // Stall indefinitely — we just want to see the loading state
      await new Promise(() => {});
      await route.continue();
    });

    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'hunter2');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('button', { name: /signing in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  test('displays an error message on bad credentials', async ({ page }) => {
    // Return a 400 from the Supabase token endpoint
    await page.route('**/auth/v1/token**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      });
    });

    await page.fill('#email', 'wrong@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // The component surfaces the error from signInError.message
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  });
});

test.describe('Signup page', () => {
  test('renders the sign-up form', async ({ page }) => {
    await page.goto('/signup');

    // Should have the sign-up heading or similar
    const heading = page.getByRole('heading');
    await expect(heading).toBeVisible();

    // Must have email and password inputs
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('has a link back to login', async ({ page }) => {
    await page.goto('/signup');
    const loginLink = page.getByRole('link', { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });
});

test.describe('Auth redirect', () => {
  test('allows requests through when Supabase is unconfigured (CI/test environment)', async ({ page }) => {
    // In CI/test environments, Supabase env vars are placeholder values.
    // The proxy bypasses auth enforcement when Supabase is not configured,
    // allowing all requests through without redirecting to /login.
    await page.goto('/');
    // Should NOT redirect to /login — stays on root path
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
  });

  test('/api/agents/* passes through when Supabase is unconfigured', async ({ page }) => {
    // With Supabase unconfigured, the proxy lets API requests through.
    // The route handler may still return an error if the backend service
    // (agents app) is unreachable, but it will NOT be a 401 from the proxy.
    const response = await page.request.get('/api/agents/cycles');
    // Must NOT be blocked by auth gate (401/403)
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
  });
});
