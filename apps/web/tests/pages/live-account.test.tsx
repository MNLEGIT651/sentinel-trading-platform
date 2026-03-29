import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';

// ─── Mocks ──────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/onboarding/live-account',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/use-onboarding', () => ({
  useOnboardingProfile: () => ({
    data: {
      user_id: 'user-123',
      onboarding_step: 'paper_active',
      legal_name: null,
      date_of_birth: null,
    },
    isLoading: false,
    error: null,
  }),
  useInvalidateOnboarding: () => vi.fn(),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Dynamic import after mocks
const { default: LiveAccountPage } = await import('@/app/(dashboard)/onboarding/live-account/page');

describe('Live Account Onboarding Page', () => {
  it('renders the page title', async () => {
    renderWithProviders(<LiveAccountPage />);
    await waitFor(() => {
      expect(screen.getByText(/Live Trading Account/i)).toBeInTheDocument();
    });
  });

  it('shows step indicators', async () => {
    renderWithProviders(<LiveAccountPage />);
    await waitFor(() => {
      // Should show at least one Disclosures element (step indicator or panel)
      const matches = screen.getAllByText(/Disclosures/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});
