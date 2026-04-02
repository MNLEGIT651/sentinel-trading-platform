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

import { useAccountQuery } from '@/hooks/queries/use-account-query';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAccountQuery', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          equity: 100000,
          cash: 50000,
          buying_power: 200000,
          portfolio_value: 100000,
        }),
      }),
    );
  });

  it('fetches account data from engine API', async () => {
    const { result } = renderHook(() => useAccountQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.equity).toBe(100000);
    expect(result.current.data!.cash).toBe(50000);
  });

  it('calls the correct engine URL', async () => {
    const { result } = renderHook(() => useAccountQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/portfolio/account',
      expect.objectContaining({
        headers: { 'X-API-Key': 'test-key' },
      }),
    );
  });

  it('handles fetch errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const { result } = renderHook(() => useAccountQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('503');
  });
});
