import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/engine-fetch', () => ({
  engineUrl: (path: string) => `http://localhost:8000${path}`,
  engineHeaders: () => ({ 'X-API-Key': 'test-key' }),
}));

vi.mock('@/stores/app-store', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ engineOnline: true }),
}));

import { useStrategiesQuery } from '@/hooks/queries/use-strategies-query';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useStrategiesQuery', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          strategies: [
            { name: 'rsi_momentum', family: 'momentum', description: 'RSI-based momentum' },
            { name: 'mean_reversion', family: 'reversion', description: 'Mean reversion' },
          ],
          families: ['momentum', 'reversion'],
          total: 2,
        }),
      }),
    );
  });

  it('fetches strategies from engine API', async () => {
    const { result } = renderHook(() => useStrategiesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].name).toBe('rsi_momentum');
    expect(result.current.data![1].family).toBe('reversion');
  });

  it('extracts strategies array from response', async () => {
    const { result } = renderHook(() => useStrategiesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The hook should return just the strategies array, not the full response
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('handles fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { result } = renderHook(() => useStrategiesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
