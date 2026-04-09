import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Supabase mock ──────────────────────────────────────────────────

function chainable(terminalData: unknown = null, terminalError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const proxy: Record<string, unknown> = new Proxy(chain, {
    get(_target, prop) {
      if (prop === 'data') return terminalData;
      if (prop === 'error') return terminalError;
      if (prop === 'single') return () => ({ data: terminalData, error: terminalError });
      if (prop === 'then') return undefined; // prevent Promise-like resolution
      return () => proxy;
    },
  });
  return proxy;
}

const mockSupabase = {
  from: vi.fn(() => chainable()),
};

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('buildAdvisorContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the from mock to default empty responses
    mockSupabase.from.mockImplementation(((table: string) => {
      if (table === 'advisor_profiles') {
        return chainable({ profile: { risk_tolerance: 'moderate' } });
      }
      if (table === 'advisor_preferences') {
        return chainable([
          {
            id: 'p1',
            category: 'sector',
            content: 'Avoid biotech',
            context: null,
            confidence: 1.0,
            status: 'active',
          },
        ]);
      }
      if (table === 'advisor_threads') {
        return chainable(null, { code: 'PGRST116' }); // no thread
      }
      if (table === 'advisor_messages') {
        return chainable([]);
      }
      return chainable();
    }) as never);
  });

  it('assembles context with profile and preferences', async () => {
    const { buildAdvisorContext } = await import('@/lib/advisor-context');
    const ctx = await buildAdvisorContext('user-1');

    expect(ctx).toBeDefined();
    expect(ctx.profile).toBeDefined();
    expect(ctx.active_preferences).toBeDefined();
    expect(ctx.pending_preferences).toBeDefined();
    expect(ctx.recent_messages).toBeDefined();
    expect(typeof ctx.preference_count).toBe('number');
    expect(typeof ctx.profile_completeness).toBe('number');
  });

  it('handles missing profile gracefully', async () => {
    mockSupabase.from.mockImplementation(((table: string) => {
      if (table === 'advisor_profiles') {
        return chainable(null, { code: 'PGRST116' });
      }
      if (table === 'advisor_preferences') {
        return chainable([]);
      }
      return chainable(null, { code: 'PGRST116' });
    }) as never);

    const { buildAdvisorContext } = await import('@/lib/advisor-context');
    const ctx = await buildAdvisorContext('user-1');

    expect(ctx).toBeDefined();
    // Profile defaults to {} when missing
    expect(ctx.profile).toEqual({});
    expect(ctx.active_preferences).toEqual([]);
  });
});
