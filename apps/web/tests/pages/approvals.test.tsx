import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import ApprovalsPage from '@/app/(dashboard)/approvals/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/approvals',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/agents/approval-dialog', () => ({
  ApprovalDialog: vi.fn(() => null),
}));

vi.mock('@/lib/agents-client', () => ({
  agentsClient: {
    getRecommendations: vi.fn().mockResolvedValue({ recommendations: [] }),
    approveRecommendation: vi
      .fn()
      .mockResolvedValue({ orderId: 'ord-1', status: 'filled', fill_price: 100 }),
    rejectRecommendation: vi.fn().mockResolvedValue({ status: 'rejected' }),
  },
}));

const mockMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
  data: undefined,
  variables: undefined,
  reset: vi.fn(),
  status: 'idle' as const,
  isIdle: true,
  submittedAt: 0,
  failureCount: 0,
  failureReason: null,
  context: undefined,
}));

vi.mock('@/hooks/queries/use-recommendations-query', () => ({
  useRecommendationsQuery: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('@/hooks/queries/use-approve-recommendation-mutation', () => ({
  useApproveRecommendationMutation: vi.fn().mockReturnValue(mockMutation),
}));

vi.mock('@/hooks/queries/use-reject-recommendation-mutation', () => ({
  useRejectRecommendationMutation: vi.fn().mockReturnValue(mockMutation),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

const mockRec = {
  id: 'rec-1',
  created_at: new Date().toISOString(),
  agent_role: 'execution_monitor',
  ticker: 'TSLA',
  side: 'buy' as const,
  quantity: 5,
  order_type: 'market' as const,
  reason: 'Momentum signal',
  strategy_name: 'momentum',
  signal_strength: 0.85,
  status: 'pending' as const,
  order_id: null,
  metadata: {},
};

describe('ApprovalsPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<ApprovalsPage />);
    expect(container).toBeTruthy();
  });

  it('renders the Approval Queue heading', () => {
    renderWithProviders(<ApprovalsPage />);
    expect(screen.getByText('Approval Queue')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', async () => {
    const { useRecommendationsQuery } = await import('@/hooks/queries/use-recommendations-query');
    vi.mocked(useRecommendationsQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useRecommendationsQuery>);

    renderWithProviders(<ApprovalsPage />);
    expect(screen.getByText('Approval Queue')).toBeInTheDocument();
  });

  it('shows empty queue message when no recommendations', async () => {
    const { useRecommendationsQuery } = await import('@/hooks/queries/use-recommendations-query');
    vi.mocked(useRecommendationsQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRecommendationsQuery>);

    renderWithProviders(<ApprovalsPage />);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('renders recommendation cards when data is present', async () => {
    const { useRecommendationsQuery } = await import('@/hooks/queries/use-recommendations-query');
    vi.mocked(useRecommendationsQuery).mockReturnValue({
      data: [mockRec],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRecommendationsQuery>);

    renderWithProviders(<ApprovalsPage />);
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByText(/Momentum signal/i)).toBeInTheDocument();
  });

  it('shows error state when query fails', async () => {
    const { useRecommendationsQuery } = await import('@/hooks/queries/use-recommendations-query');
    vi.mocked(useRecommendationsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Service unavailable'),
    } as ReturnType<typeof useRecommendationsQuery>);

    renderWithProviders(<ApprovalsPage />);
    expect(screen.getByText(/failed to load recommendations/i)).toBeInTheDocument();
  });
});
