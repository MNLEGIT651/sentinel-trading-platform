import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AuthErrorPage from '@/app/auth/error/page';
import { renderWithProviders } from '../test-utils';

/* ── Mocks ─────────────────────────────────────────────────── */

let mockSearchParams = new URLSearchParams();
const mockResend = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resend: mockResend,
    },
  }),
}));

/* ── Tests ─────────────────────────────────────────────────── */

describe('AuthErrorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockResend.mockResolvedValue({ error: null });
  });

  it('shows fallback error when no reason param', () => {
    renderWithProviders(<AuthErrorPage />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('shows correct copy for missing_params reason', () => {
    mockSearchParams = new URLSearchParams('reason=missing_params');
    renderWithProviders(<AuthErrorPage />);
    expect(screen.getByText(/invalid confirmation link/i)).toBeInTheDocument();
  });

  it('shows correct copy for code_exchange_failed reason', () => {
    mockSearchParams = new URLSearchParams('reason=code_exchange_failed');
    renderWithProviders(<AuthErrorPage />);
    expect(screen.getByText(/expired or already used/i)).toBeInTheDocument();
  });

  it('shows correct copy for token_verification_failed reason', () => {
    mockSearchParams = new URLSearchParams('reason=token_verification_failed');
    renderWithProviders(<AuthErrorPage />);
    expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
  });

  it('shows resend form for recoverable errors', () => {
    mockSearchParams = new URLSearchParams('reason=code_exchange_failed');
    renderWithProviders(<AuthErrorPage />);
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument();
  });

  it('sends resend confirmation email', async () => {
    mockSearchParams = new URLSearchParams('reason=code_exchange_failed');
    renderWithProviders(<AuthErrorPage />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@test.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /resend/i }));

    await waitFor(() => {
      expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'user@test.com' });
    });
    expect(screen.getByText(/confirmation email sent/i)).toBeInTheDocument();
  });

  it('shows error when resend fails', async () => {
    mockResend.mockResolvedValue({ error: { message: 'Rate limit' } });
    mockSearchParams = new URLSearchParams('reason=code_exchange_failed');
    renderWithProviders(<AuthErrorPage />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@test.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /resend/i }));

    await waitFor(() => {
      expect(screen.getByText('Rate limit')).toBeInTheDocument();
    });
  });

  it('has navigation links to sign in and sign up', () => {
    renderWithProviders(<AuthErrorPage />);
    expect(screen.getByText(/go to sign in/i)).toHaveAttribute('href', '/login');
    expect(screen.getByText(/create a new account/i)).toHaveAttribute('href', '/signup');
  });
});
