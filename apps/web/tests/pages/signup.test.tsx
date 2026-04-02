import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import SignUpPage from '@/app/(auth)/signup/page';
import { renderWithProviders } from '../test-utils';

/* ── Mocks ─────────────────────────────────────────────────── */

const mockSignUp = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      resend: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

vi.mock('@/lib/auth/url', () => ({
  getEmailRedirectUrl: () => 'http://localhost:3000/auth/callback',
}));

// Mock fetch for consent recording
const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

/* ── Helpers ───────────────────────────────────────────────── */

function fillForm(
  email = 'user@test.com',
  password = 'password123',
  confirm = 'password123',
  terms = true,
  privacy = true,
) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirm } });
  if (terms) fireEvent.click(screen.getByRole('checkbox', { name: /terms/i }));
  if (privacy) fireEvent.click(screen.getByRole('checkbox', { name: /privacy/i }));
}

/* ── Tests ─────────────────────────────────────────────────── */

describe('SignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockSignUp.mockResolvedValue({ error: null });
  });

  it('renders the signup form with all required fields', () => {
    renderWithProviders(<SignUpPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /terms/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /privacy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('disables submit when terms/privacy not checked', () => {
    renderWithProviders(<SignUpPage />);
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  it('shows error when passwords do not match', async () => {
    renderWithProviders(<SignUpPage />);
    fillForm('user@test.com', 'password123', 'different');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows error when password is too short', async () => {
    renderWithProviders(<SignUpPage />);
    fillForm('user@test.com', 'short', 'short');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows success message after successful signup', async () => {
    renderWithProviders(<SignUpPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123',
      options: { emailRedirectTo: 'http://localhost:3000/auth/callback' },
    });
  });

  it('records consent after successful signup', async () => {
    renderWithProviders(<SignUpPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2); // terms + privacy
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/onboarding/consent',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('shows error when signup fails on backend', async () => {
    mockSignUp.mockResolvedValue({ error: { message: 'User already registered' } });
    renderWithProviders(<SignUpPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('User already registered')).toBeInTheDocument();
    });
  });

  it('handles unexpected errors gracefully', async () => {
    mockSignUp.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<SignUpPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });
  });

  it('shows loading state while submitting', async () => {
    mockSignUp.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<SignUpPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
    });
  });

  it('has sign-in link for existing users', () => {
    renderWithProviders(<SignUpPage />);
    expect(screen.getByText('Sign in')).toHaveAttribute('href', '/login');
  });
});
