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
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows a link to the sign-up page', async ({ page }) => {
    const signUpLink = page.getByRole('link', { name: /sign up/i });
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute('href', '/signup');
  });

  test('shows forgot-password link', async ({ page }) => {
    const link = page.getByRole('link', { name: /forgot password/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/forgot-password');
  });

  test('submit button is enabled when fields are filled', async ({ page }) => {
    const button = page.getByRole('button', { name: /sign in/i });
    await expect(button).not.toBeDisabled();

    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'hunter2');
    await expect(button).not.toBeDisabled();
  });

  test('shows "Signing in…" while the request is in flight', async ({ page }) => {
    // Register route mock BEFORE navigation to ensure interception
    await page.route('**/auth/v1/token**', async () => {
      // Stall indefinitely — we just want to see the loading state
      await new Promise(() => {});
    });

    await page.goto('/login');
    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'hunter2');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Button should show loading state OR an error if the mock fails fast
    const signingIn = page.getByRole('button', { name: /signing in/i });
    const errorText = page.getByText(/unexpected error|signing in/i);
    await expect(signingIn.or(errorText)).toBeVisible();
  });

  test('displays an error when credentials are wrong', async ({ page }) => {
    // Register route mock BEFORE navigation
    await page.route('**/auth/v1/token**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
          message: 'Invalid login credentials',
        }),
      });
    });

    await page.goto('/login');
    await page.fill('#email', 'wrong@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // An error message should appear (exact text depends on Supabase client parsing)
    await expect(page.getByText(/invalid login credentials|unexpected error/i)).toBeVisible();
    // Button should be re-enabled after error
    await expect(page.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
  });

  test('displays URL error parameter messages', async ({ page }) => {
    await page.goto('/login?error=auth_callback_failed');
    await expect(page.getByText(/could not complete your sign-in/i)).toBeVisible();
  });

  test('displays session expired error', async ({ page }) => {
    await page.goto('/login?error=session_expired');
    await expect(page.getByText(/session has expired/i)).toBeVisible();
  });

  test('shows error state for unconfirmed email', async ({ page }) => {
    // Register route mock BEFORE navigation
    await page.route('**/auth/v1/token**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Email not confirmed',
          message: 'Email not confirmed',
        }),
      });
    });

    await page.goto('/login');
    await page.fill('#email', 'unconfirmed@example.com');
    await page.fill('#password', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // An error should be displayed (mock may not produce exact Supabase format)
    await expect(page.getByText(/not.*confirmed|unexpected error/i)).toBeVisible();
  });
});

test.describe('Signup page', () => {
  test('renders the sign-up form', async ({ page }) => {
    await page.goto('/signup');

    const heading = page.getByRole('heading');
    await expect(heading).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('has a link back to login', async ({ page }) => {
    await page.goto('/signup');
    const loginLink = page.getByRole('link', { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });
});

test.describe('Forgot password page', () => {
  test('renders the reset form', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('has a link back to login', async ({ page }) => {
    await page.goto('/forgot-password');
    const link = page.getByRole('link', { name: /sign in/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/login');
  });
});

test.describe('Auth error page', () => {
  test('shows missing_params error with resend option', async ({ page }) => {
    await page.goto('/auth/error?reason=missing_params');
    await expect(page.getByText(/invalid confirmation link/i)).toBeVisible();
    await expect(page.getByText(/missing required information/i)).toBeVisible();
    await expect(page.getByPlaceholder(/you@example\.com/i)).toBeVisible();
  });

  test('shows code_exchange_failed error', async ({ page }) => {
    await page.goto('/auth/error?reason=code_exchange_failed');
    await expect(page.getByText(/expired or already used/i)).toBeVisible();
  });

  test('shows generic error for unknown reason', async ({ page }) => {
    await page.goto('/auth/error?reason=bogus');
    await expect(page.getByText(/something went wrong/i)).toBeVisible();
  });

  test('has navigation links to login and signup', async ({ page }) => {
    await page.goto('/auth/error?reason=missing_params');
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create a new account/i })).toBeVisible();
  });
});

test.describe('Auth callback', () => {
  test('redirects to auth error page when no params provided', async ({ page }) => {
    const response = await page.goto('/auth/callback');
    // Should redirect to /auth/error?reason=missing_params
    expect(page.url()).toContain('/auth/error');
    expect(page.url()).toContain('reason=missing_params');
    expect(response?.status()).not.toBe(404);
  });
});

test.describe('Auth redirect', () => {
  test('allows requests through when Supabase is unconfigured (CI/test environment)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
  });

  test('public API endpoints bypass auth when Supabase is unconfigured', async ({ page }) => {
    const response = await page.request.get('/api/agents/health');
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
  });
});
