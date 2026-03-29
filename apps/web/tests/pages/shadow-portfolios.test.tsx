import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import ShadowPortfoliosPage from '@/app/(dashboard)/shadow-portfolios/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/shadow-portfolios',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useShadowPortfoliosQuery: vi.fn(() => ({
      data: undefined,
      isLoading: false,
      error: null,
    })),
    useCreateShadowPortfolioMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    })),
    useDeleteShadowPortfolioMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('ShadowPortfoliosPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<ShadowPortfoliosPage />);
    expect(container).toBeTruthy();
  });

  it('renders the Shadow Portfolios heading', () => {
    renderWithProviders(<ShadowPortfoliosPage />);
    expect(screen.getByText('Shadow Portfolios')).toBeInTheDocument();
  });

  it('shows info banner about Champion-Challenger framework', () => {
    renderWithProviders(<ShadowPortfoliosPage />);
    expect(screen.getByText(/Champion/i)).toBeInTheDocument();
  });

  it('shows empty state when no portfolios', () => {
    renderWithProviders(<ShadowPortfoliosPage />);
    expect(screen.getByText('No shadow portfolios yet')).toBeInTheDocument();
  });

  it('shows New Shadow button in header', () => {
    renderWithProviders(<ShadowPortfoliosPage />);
    expect(screen.getByText('New Shadow')).toBeInTheDocument();
  });

  it('shows create button in empty state', () => {
    renderWithProviders(<ShadowPortfoliosPage />);
    expect(screen.getByText('Create Shadow Portfolio')).toBeInTheDocument();
  });
});
