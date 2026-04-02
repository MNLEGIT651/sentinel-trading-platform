import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';
import { renderWithProviders } from '../test-utils';

/* ── Mocks ─────────────────────────────────────────────────── */

const mockResetPasswordForEmail = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}));

vi.mock('@/lib/auth/url', () => ({
  getPasswordRecoveryRedirectUrl: () => 'http://localhost:3000/auth/callback?type=recovery',
}));

/* ── Tests ─────────────────────────────────────────────────── */

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it('renders the forgot password form', () => {
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toHaveAttribute('href', '/login');
  });

  it('shows success message after submitting valid email', async () => {
    renderWithProviders(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@test.com', {
      redirectTo: 'http://localhost:3000/auth/callback?type=recovery',
    });
  });

  it('shows error when API fails', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    });
    renderWithProviders(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
    });
  });

  it('handles unexpected errors gracefully', async () => {
    mockResetPasswordForEmail.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });
  });

  it('shows loading state while submitting', async () => {
    mockResetPasswordForEmail.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    });
  });

  it('prevents double-submit while loading', async () => {
    mockResetPasswordForEmail.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    // Attempt second submit
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /sending/i }));
    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
  });
});
