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
      'fills',
      'portfolio_positions',
      'signals',
      'signal_runs',
      'agent_recommendations',
      'recommendation_events',
      'alerts',
      'system_controls',
      'operator_actions',
      'risk_evaluations',
      'market_data',
      'workflow_jobs',
      'workflow_step_log',
      'user_trading_policy',
      'decision_journal',
      'regime_playbooks',
      'user_profiles',
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
    expect(mockSupabaseClient.removeChannel.mock.calls.length).toBeGreaterThanOrEqual(18);
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

  it('invalidates agents and counterfactuals queries when agent_recommendations changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const recsSub = subscriptions.find((s) => s.table === 'agent_recommendations');
    expect(recsSub).toBeDefined();
    recsSub!.callback({ eventType: 'UPDATE', new: { id: '1', status: 'rejected' }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['agents'] }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['counterfactuals'] }));
  });

  it('invalidates regime queries when regime_playbooks changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const playbookSub = subscriptions.find((s) => s.table === 'regime_playbooks');
    expect(playbookSub).toBeDefined();
    playbookSub!.callback({ eventType: 'UPDATE', new: { id: '1', is_active: true }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['regime'] }));
  });

  it('invalidates roles queries when user_profiles changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const profileSub = subscriptions.find((s) => s.table === 'user_profiles');
    expect(profileSub).toBeDefined();
    profileSub!.callback({ eventType: 'UPDATE', new: { id: '1', role: 'approver' }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['roles'] }));
  });

  it('invalidates system controls queries when system_controls changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const sysSub = subscriptions.find((s) => s.table === 'system_controls');
    expect(sysSub).toBeDefined();
    sysSub!.callback({ eventType: 'UPDATE', new: { id: '1', trading_halted: true }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['system-controls'] }));
  });

  it('invalidates recommendation event queries when recommendation_events changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const recEvtSub = subscriptions.find((s) => s.table === 'recommendation_events');
    expect(recEvtSub).toBeDefined();
    recEvtSub!.callback({ eventType: 'INSERT', new: { id: '1', event_type: 'approved' }, old: {} });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['recommendation-events'] }),
    );
  });

  it('invalidates risk evaluations queries when risk_evaluations changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const riskSub = subscriptions.find((s) => s.table === 'risk_evaluations');
    expect(riskSub).toBeDefined();
    riskSub!.callback({ eventType: 'INSERT', new: { id: '1', allowed: true }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['risk-evaluations'] }));
  });

  it('invalidates fills and order queries when fills changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const fillsSub = subscriptions.find((s) => s.table === 'fills');
    expect(fillsSub).toBeDefined();
    fillsSub!.callback({ eventType: 'INSERT', new: { id: '1', fill_qty: 100 }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['fills'] }));
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['portfolio', 'orders'] }),
    );
  });

  it('invalidates operator actions queries when operator_actions changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const opSub = subscriptions.find((s) => s.table === 'operator_actions');
    expect(opSub).toBeDefined();
    opSub!.callback({
      eventType: 'INSERT',
      new: { id: '1', action_type: 'halt_trading' },
      old: {},
    });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['operator-actions'] }));
  });

  it('invalidates signal runs queries when signal_runs changes', () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useRealtimeSync(), { wrapper: wrapper(qc) });

    const runSub = subscriptions.find((s) => s.table === 'signal_runs');
    expect(runSub).toBeDefined();
    runSub!.callback({ eventType: 'INSERT', new: { id: '1', status: 'completed' }, old: {} });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['signal-runs'] }));
  });
});
