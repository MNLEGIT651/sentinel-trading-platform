import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Sidebar } from '@/components/layout/sidebar';
import { renderWithProviders } from '../test-utils';

/* ── Mocks ─────────────────────────────────────────────────── */

const mockSignOut = vi.fn();
let mockQueryClear = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}));

// Override useQueryClient to spy on clear()
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      clear: mockQueryClear,
    }),
  };
});

// Suppress matchMedia for sidebar responsiveness
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/* ── Tests ─────────────────────────────────────────────────── */

describe('Sidebar logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    mockQueryClear = vi.fn();
    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '/' },
      writable: true,
    });
  });

  it('renders sign out button', () => {
    renderWithProviders(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    expect(screen.getByTitle('Sign out')).toBeInTheDocument();
  });

  it('calls signOut and clears query cache on click', async () => {
    renderWithProviders(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Sign out'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockQueryClear).toHaveBeenCalled();
    });
    expect(window.location.href).toBe('/login');
  });

  it('redirects to /login even if signOut throws', async () => {
    mockSignOut.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Sign out'));

    await waitFor(() => {
      expect(window.location.href).toBe('/login');
    });
  });

  it('shows "Signing out…" text during signout', async () => {
    mockSignOut.mockReturnValue(new Promise(() => {})); // hang
    renderWithProviders(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Sign out'));

    await waitFor(() => {
      expect(screen.getByText('Signing out…')).toBeInTheDocument();
    });
  });

  it('disables the button during signout to prevent double-click', async () => {
    mockSignOut.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    const btn = screen.getByTitle('Sign out');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(btn).toBeDisabled();
    });
  });
});
