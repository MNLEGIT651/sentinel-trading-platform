import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import RecommendationDetailPage from '@/app/(dashboard)/recommendations/[id]/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/recommendations/test-rec-1',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    use: vi.fn().mockReturnValue({ id: 'test-rec-1' }),
  };
});

vi.mock('@/hooks/queries/use-recommendation-events-query', () => ({
  useRecommendationEventsQuery: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    error: new Error('Not found'),
  })),
}));

vi.mock('@/hooks/queries/use-approve-recommendation-mutation', () => ({
  useApproveRecommendationMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/hooks/queries/use-reject-recommendation-mutation', () => ({
  useRejectRecommendationMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('RecommendationDetailPage', () => {
  it('renders without crashing', () => {
    const params = Promise.resolve({ id: 'test-rec-1' });
    const { container } = renderWithProviders(<RecommendationDetailPage params={params} />);
    expect(container).toBeTruthy();
  });

  it('shows error state when data is unavailable', () => {
    const params = Promise.resolve({ id: 'test-rec-1' });
    renderWithProviders(<RecommendationDetailPage params={params} />);
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', async () => {
    const { useRecommendationEventsQuery } = vi.mocked(
      await import('@/hooks/queries/use-recommendation-events-query'),
    );
    useRecommendationEventsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useRecommendationEventsQuery>);

    const params = Promise.resolve({ id: 'test-rec-1' });
    renderWithProviders(<RecommendationDetailPage params={params} />);
    expect(screen.getByText('Loading recommendation…')).toBeInTheDocument();
  });
});
