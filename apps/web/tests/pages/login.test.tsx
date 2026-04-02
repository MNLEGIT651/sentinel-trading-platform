import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';
import { renderWithProviders } from '../test-utils';

/* ── Mocks ─────────────────────────────────────────────────── */

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignInWithPassword = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      resend: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

/* ── Helpers ───────────────────────────────────────────────── */

function fillAndSubmit(email = 'user@test.com', password = 'password123') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

/* ── Tests ─────────────────────────────────────────────────── */

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockSignInWithPassword.mockResolvedValue({ error: null });
  });

  it('renders the login form with email, password, and submit button', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders sign-up and forgot-password links', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('Create one')).toHaveAttribute('href', '/signup');
    expect(screen.getByText('Forgot password?')).toHaveAttribute('href', '/forgot-password');
  });

  it('calls signInWithPassword and redirects on success', async () => {
    renderWithProviders(<LoginPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'user@test.com',
        password: 'password123',
      });
    });
    expect(mockPush).toHaveBeenCalledWith('/');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('preserves the "next" search param for redirect', async () => {
    mockSearchParams = new URLSearchParams('next=/settings');
    renderWithProviders(<LoginPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });
  });

  it('shows error on invalid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    renderWithProviders(<LoginPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows unconfirmed email state with resend option', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Email not confirmed' },
    });
    renderWithProviders(<LoginPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/not been confirmed/)).toBeInTheDocument();
    });
    expect(screen.getByText(/resend confirmation/i)).toBeInTheDocument();
  });

  it('handles unexpected errors gracefully', async () => {
    mockSignInWithPassword.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<LoginPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });
  });

  it('shows URL error messages from query params', () => {
    mockSearchParams = new URLSearchParams('error=session_expired');
    renderWithProviders(<LoginPage />);
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
  });

  it('shows loading state while submitting', async () => {
    // Make signIn hang so we can check loading state
    mockSignInWithPassword.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<LoginPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });
  });

  it('prevents double-submit while loading', async () => {
    mockSignInWithPassword.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<LoginPage />);

    fillAndSubmit();
    // Try to submit again (button is disabled)
    fireEvent.click(screen.getByRole('button', { name: /signing in/i }));

    // Should only have been called once
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
  });
});
