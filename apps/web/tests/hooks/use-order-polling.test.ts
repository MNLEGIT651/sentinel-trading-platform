import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrderPolling } from '@/hooks/use-order-polling';

// Mock engine-fetch
vi.mock('@/lib/engine-fetch', () => ({
  engineUrl: (path: string) => `http://localhost:8000${path}`,
  engineHeaders: () => ({ 'X-API-Key': 'test-key' }),
}));

describe('useOrderPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not poll when orderId is null', () => {
    const onSettled = vi.fn();
    renderHook(() => useOrderPolling({ orderId: null, onSettled }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('starts polling when orderId is set', async () => {
    const filledOrder = { order_id: 'abc', status: 'filled', symbol: 'AAPL' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => filledOrder,
    });

    const onSettled = vi.fn();
    renderHook(() => useOrderPolling({ orderId: 'abc', onSettled }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/orders/abc'),
      expect.any(Object),
    );
  });

  it('stops polling on terminal status and calls onSettled', async () => {
    const filledOrder = { order_id: 'abc', status: 'filled', symbol: 'AAPL' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => filledOrder,
    });

    const onSettled = vi.fn();
    renderHook(() => useOrderPolling({ orderId: 'abc', onSettled }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSettled).toHaveBeenCalledWith(filledOrder);

    // Should not poll again
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('continues polling on non-terminal status', async () => {
    const acceptedOrder = { order_id: 'abc', status: 'accepted', symbol: 'AAPL' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => acceptedOrder,
    });

    const onSettled = vi.fn();
    renderHook(() => useOrderPolling({ orderId: 'abc', onSettled }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onSettled).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    // Should have polled twice
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns isPolling true while active', async () => {
    const acceptedOrder = { order_id: 'abc', status: 'accepted', symbol: 'AAPL' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => acceptedOrder,
    });

    const onSettled = vi.fn();
    const { result } = renderHook(() => useOrderPolling({ orderId: 'abc', onSettled }));

    // Flush the useEffect that sets isPolling=true
    await act(async () => {});
    expect(result.current.isPolling).toBe(true);
  });

  it('stops polling after the timeout and reports the last order state', async () => {
    const acceptedOrder = { order_id: 'abc', status: 'accepted', symbol: 'AAPL' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => acceptedOrder,
    });

    const onSettled = vi.fn();
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useOrderPolling({ orderId: 'abc', onSettled, onTimeout }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(onSettled).not.toHaveBeenCalled();
    expect(onTimeout).toHaveBeenCalledWith(acceptedOrder);
    expect(result.current.isPolling).toBe(false);
  });

  it('treats "rejected" as a terminal status', async () => {
    const rejectedOrder = { order_id: 'rej-1', status: 'rejected', symbol: 'TSLA' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => rejectedOrder,
    });

    const onSettled = vi.fn();
    const { result } = renderHook(() => useOrderPolling({ orderId: 'rej-1', onSettled }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSettled).toHaveBeenCalledWith(rejectedOrder);
    expect(result.current.isPolling).toBe(false);
  });

  it('treats "cancelled" as a terminal status', async () => {
    const cancelledOrder = { order_id: 'can-1', status: 'cancelled', symbol: 'MSFT' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => cancelledOrder,
    });

    const onSettled = vi.fn();
    const { result } = renderHook(() => useOrderPolling({ orderId: 'can-1', onSettled }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSettled).toHaveBeenCalledWith(cancelledOrder);
    expect(result.current.isPolling).toBe(false);
  });

  it('treats "expired" as a terminal status', async () => {
    const expiredOrder = { order_id: 'exp-1', status: 'expired', symbol: 'NVDA' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => expiredOrder,
    });

    const onSettled = vi.fn();
    const { result } = renderHook(() => useOrderPolling({ orderId: 'exp-1', onSettled }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSettled).toHaveBeenCalledWith(expiredOrder);
    expect(result.current.isPolling).toBe(false);
  });

  it('handles fetch errors gracefully and continues polling', async () => {
    let callCount = 0;
    const filledOrder = { order_id: 'abc', status: 'filled', symbol: 'AAPL' };
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('Network error');
      return { ok: true, json: async () => filledOrder };
    });

    const onSettled = vi.fn();
    renderHook(() => useOrderPolling({ orderId: 'abc', onSettled }));

    // First poll fails
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onSettled).not.toHaveBeenCalled();

    // Second poll succeeds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onSettled).toHaveBeenCalledWith(filledOrder);
  });
});
