import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import ReplayPage from '@/app/(dashboard)/replay/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/replay',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useReplayQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
  };
});

vi.mock('@/hooks/queries/use-recommendation-replay-query', () => ({
  useRecommendationSearchQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
  useRecommendationReplayQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('ReplayPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<ReplayPage />);
    expect(container).toBeTruthy();
  });

  it('renders the page heading', () => {
    renderWithProviders(<ReplayPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('shows the Recommendation Replay mode tab', () => {
    renderWithProviders(<ReplayPage />);
    expect(screen.getByText('Recommendation Replay')).toBeInTheDocument();
  });

  it('shows the System Replay mode tab', () => {
    renderWithProviders(<ReplayPage />);
    expect(screen.getByText('System Replay')).toBeInTheDocument();
  });
});
