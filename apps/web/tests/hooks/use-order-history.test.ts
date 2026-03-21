import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrderHistory } from '@/hooks/use-order-history';

vi.mock('@/lib/engine-fetch', () => ({
  engineUrl: (path: string) => `http://localhost:8000${path}`,
  engineHeaders: () => ({ 'X-API-Key': 'test-key' }),
}));

const mockOrders = [
  { order_id: '1', symbol: 'AAPL', side: 'buy', status: 'filled', submitted_at: '2026-01-02' },
  { order_id: '2', symbol: 'MSFT', side: 'sell', status: 'filled', submitted_at: '2026-01-01' },
];

describe('useOrderHistory', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOrders,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches orders on mount', async () => {
    const { result } = renderHook(() => useOrderHistory());
    await waitFor(() => {
      expect(result.current.orders).toHaveLength(2);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/orders/history'),
      expect.any(Object),
    );
  });

  it('refresh re-fetches orders', async () => {
    const { result } = renderHook(() => useOrderHistory());
    await waitFor(() => {
      expect(result.current.orders).toHaveLength(2);
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('handles fetch error gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useOrderHistory());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.orders).toHaveLength(0);
  });

  it('skips fetching when disabled', async () => {
    const { result } = renderHook(() => useOrderHistory(false));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.orders).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
