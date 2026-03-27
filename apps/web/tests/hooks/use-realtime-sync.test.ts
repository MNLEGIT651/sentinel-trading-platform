/**
 * Tests for useRealtimeSync hook.
 *
 * Verifies that Supabase Realtime events trigger the correct TanStack Query
 * cache invalidations, and that channels are properly cleaned up on unmount.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

// ── Supabase mock ──────────────────────────────────────────────────────────

type ChangeCallback = (payload: Record<string, unknown>) => void;

const subscriptions: { table: string; callback: ChangeCallback }[] = [];

const mockChannel = {
  on: vi.fn(function (
    this: typeof mockChannel,
    _type: string,
    opts: { table: string },
    callback: ChangeCallback,
  ) {
    subscriptions.push({ table: opts.table, callback });
    return this;
  }),
  subscribe: vi.fn().mockReturnThis(),
};

const mockSupabaseClient = {
  channel: vi.fn(() => ({ ...mockChannel, on: mockChannel.on })),
  removeChannel: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useRealtimeSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptions.length = 0;
    // Reset the .on mock to rebuild subscriptions each test
    mockChannel.on.mockImplementation(function (
      this: typeof mockChannel,
      _type: string,
      opts: { table: string },
      callback: ChangeCallback,
    ) {
      subscriptions.push({ table: opts.table, callback });
      return this;
    });
  });

  it('subscribes to all expected tables on mount', () => {
    const qc = makeQueryClient();
    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const expectedTables = [
      'orders',
      'portfolio_positions',
      'alerts',
      'signals',
      'market_data',
      'user_trading_policy',
      'decision_journal',
      'strategy_health_snapshots',
    ];

    // One channel per table
    expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(expectedTables.length);

    for (const table of expectedTables) {
      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(`sentinel-sync:${table}`);
    }
  });

  it('removes all channels on unmount', () => {
    const qc = makeQueryClient();
    const { unmount } = renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    expect(mockSupabaseClient.removeChannel).not.toHaveBeenCalled();
    unmount();
    // One removeChannel call per subscribed table
    expect(mockSupabaseClient.removeChannel.mock.calls.length).toBeGreaterThanOrEqual(8);
  });

  it('invalidates portfolio queries when orders table changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    // Fire the callback for the orders subscription
    const ordersSub = subscriptions.find((s) => s.table === 'orders');
    expect(ordersSub).toBeDefined();
    ordersSub!.callback({ eventType: 'INSERT', new: { id: '1' }, old: {} });

    // Should invalidate portfolio.orders.all and portfolio.account
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['portfolio', 'orders'] }),
    );
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['portfolio', 'account'] }),
    );
  });

  it('invalidates alerts queries when alerts table changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const alertsSub = subscriptions.find((s) => s.table === 'alerts');
    alertsSub!.callback({ eventType: 'INSERT', new: { id: '1' }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['agents', 'alerts'] }));
  });

  it('invalidates settings policy when user_trading_policy changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const policySub = subscriptions.find((s) => s.table === 'user_trading_policy');
    expect(policySub).toBeDefined();
    policySub!.callback({ eventType: 'UPDATE', new: { id: '1' }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['settings', 'policy'] }));
  });

  it('invalidates data queries when market_data changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const marketSub = subscriptions.find((s) => s.table === 'market_data');
    marketSub!.callback({ eventType: 'UPDATE', new: { id: '1' }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['data'] }));
  });

  it('invalidates positions and account when portfolio_positions changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const posSub = subscriptions.find((s) => s.table === 'portfolio_positions');
    posSub!.callback({ eventType: 'DELETE', new: {}, old: { id: '1' } });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['portfolio', 'positions'] }),
    );
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['portfolio', 'account'] }),
    );
  });

  it('invalidates journal queries when decision_journal changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const journalSub = subscriptions.find((s) => s.table === 'decision_journal');
    expect(journalSub).toBeDefined();
    journalSub!.callback({ eventType: 'INSERT', new: { id: '1' }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['journal'] }));
  });

  it('invalidates strategy health queries when strategy_health_snapshots changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const healthSub = subscriptions.find((s) => s.table === 'strategy_health_snapshots');
    expect(healthSub).toBeDefined();
    healthSub!.callback({ eventType: 'INSERT', new: { id: '1' }, old: {} });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['strategies', 'health'] }),
    );
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['strategies'] }));
  });
});
