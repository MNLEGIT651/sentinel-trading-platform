import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/stores/app-store', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ engineOnline: true }),
}));

import {
  useSystemControlsQuery,
  useUpdateSystemControlsMutation,
  useHaltSystemMutation,
  useResumeSystemMutation,
} from '@/hooks/queries/use-system-controls-query';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return {
    wrapper: function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children);
    },
    queryClient,
  };
}

describe('useSystemControlsQuery', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            trading_halted: false,
            autonomy_mode: 'suggest',
            live_execution_enabled: true,
          },
        }),
      }),
    );
  });

  it('fetches system controls', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSystemControlsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.trading_halted).toBe(false);
  });

  it('calls /api/system-controls', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSystemControlsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/system-controls',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      }),
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSystemControlsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Server error');
  });
});

describe('useUpdateSystemControlsMutation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { trading_halted: true, autonomy_mode: 'alert_only' },
        }),
      }),
    );
  });

  it('sends PATCH request with update data', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateSystemControlsMutation(), { wrapper });

    await act(async () => {
      result.current.mutate({ trading_halted: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/system-controls',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
});

describe('useHaltSystemMutation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { trading_halted: true },
        }),
      }),
    );
  });

  it('sends halt request', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useHaltSystemMutation(), { wrapper });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.trading_halted).toBe(true);
  });
});

describe('useResumeSystemMutation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { trading_halted: false },
        }),
      }),
    );
  });

  it('sends resume request', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useResumeSystemMutation(), { wrapper });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.trading_halted).toBe(false);
  });
});
