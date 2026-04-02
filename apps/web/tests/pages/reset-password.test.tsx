import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ResetPasswordPage from '@/app/(auth)/reset-password/page';
import { renderWithProviders } from '../test-utils';

/* ── Mocks ─────────────────────────────────────────────────── */

const mockPush = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
    },
  }),
}));

/* ── Helpers ───────────────────────────────────────────────── */

function fillAndSubmit(password = 'newpass123', confirm = 'newpass123') {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: /update password/i }));
}

/* ── Tests ─────────────────────────────────────────────────── */

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it('renders the reset password form', () => {
    renderWithProviders(<ResetPasswordPage />);
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    renderWithProviders(<ResetPasswordPage />);
    fillAndSubmit('newpass123', 'different');

    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('shows error when password is too short', async () => {
    renderWithProviders(<ResetPasswordPage />);
    fillAndSubmit('short', 'short');

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('shows success after update', async () => {
    renderWithProviders(<ResetPasswordPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/password updated/i)).toBeInTheDocument();
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass123' });
  });

  it('shows error when updateUser fails', async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: 'Password should be at least 6 characters' },
    });
    renderWithProviders(<ResetPasswordPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText('Password should be at least 6 characters')).toBeInTheDocument();
    });
  });

  it('handles unexpected errors gracefully', async () => {
    mockUpdateUser.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<ResetPasswordPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });
  });

  it('shows loading state while submitting', async () => {
    mockUpdateUser.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ResetPasswordPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /updating/i })).toBeDisabled();
    });
  });
});
