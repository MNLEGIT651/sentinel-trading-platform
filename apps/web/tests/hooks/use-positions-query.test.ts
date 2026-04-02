import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@/lib/engine-fetch', () => ({
  engineUrl: (path: string) => `http://localhost:8000${path}`,
  engineHeaders: () => ({ 'X-API-Key': 'test-key' }),
}));

vi.mock('@/stores/app-store', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ engineOnline: true, agentsOnline: true }),
}));

import { usePositionsQuery } from '@/hooks/queries/use-positions-query';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('usePositionsQuery', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { instrument_id: 'AAPL', quantity: 10, market_value: 1500 },
          { instrument_id: 'MSFT', quantity: 5, market_value: 2000 },
        ],
      }),
    );
  });

  it('fetches positions from engine API', async () => {
    const { result } = renderHook(() => usePositionsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].instrument_id).toBe('AAPL');
  });

  it('calls the correct engine URL', async () => {
    const { result } = renderHook(() => usePositionsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/portfolio/positions',
      expect.objectContaining({
        headers: { 'X-API-Key': 'test-key' },
      }),
    );
  });

  it('handles fetch errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const { result } = renderHook(() => usePositionsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('500');
  });
});
