import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/stores/app-store', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ agentsOnline: true }),
}));

vi.mock('@/lib/agents-client', () => ({
  agentsClient: {
    getRecommendations: vi.fn(),
  },
}));

import { useRecommendationsQuery } from '@/hooks/queries/use-recommendations-query';
import { agentsClient } from '@/lib/agents-client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useRecommendationsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches pending recommendations by default', async () => {
    const mockRecs = [
      {
        id: 'rec-1',
        created_at: '2024-01-01T00:00:00Z',
        agent_role: 'analyst',
        ticker: 'AAPL',
        side: 'buy' as const,
        quantity: 10,
        order_type: 'market' as const,
        status: 'pending' as const,
      },
      {
        id: 'rec-2',
        created_at: '2024-01-01T00:00:00Z',
        agent_role: 'analyst',
        ticker: 'MSFT',
        side: 'sell' as const,
        quantity: 5,
        order_type: 'market' as const,
        status: 'pending' as const,
      },
    ];
    vi.mocked(agentsClient.getRecommendations).mockResolvedValue({
      recommendations: mockRecs,
    });

    const { result } = renderHook(() => useRecommendationsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]!.ticker).toBe('AAPL');
    expect(agentsClient.getRecommendations).toHaveBeenCalledWith('pending');
  });

  it('fetches with custom status filter', async () => {
    vi.mocked(agentsClient.getRecommendations).mockResolvedValue({
      recommendations: [
        {
          id: 'rec-3',
          created_at: '2024-01-01T00:00:00Z',
          agent_role: 'analyst',
          ticker: 'GOOG',
          side: 'buy' as const,
          quantity: 10,
          order_type: 'market' as const,
          status: 'approved' as const,
        },
      ],
    });

    const { result } = renderHook(() => useRecommendationsQuery('approved'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(agentsClient.getRecommendations).toHaveBeenCalledWith('approved');
    expect(result.current.data).toHaveLength(1);
  });

  it('fetches all recommendations', async () => {
    vi.mocked(agentsClient.getRecommendations).mockResolvedValue({
      recommendations: [],
    });

    const { result } = renderHook(() => useRecommendationsQuery('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(agentsClient.getRecommendations).toHaveBeenCalledWith('all');
  });

  it('handles API errors', async () => {
    vi.mocked(agentsClient.getRecommendations).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useRecommendationsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});
