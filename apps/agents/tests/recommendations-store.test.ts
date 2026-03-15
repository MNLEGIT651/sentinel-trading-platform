// apps/agents/tests/recommendations-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase client
const mockFrom = vi.fn();
vi.mock('../src/supabase-client.js', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

const { createRecommendation, listRecommendations, atomicApprove, rejectRecommendation, createAlert, listAlerts } =
  await import('../src/recommendations-store.js');

describe('createRecommendation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a pending recommendation and returns it', async () => {
    const rec = {
      agent_role: 'execution_monitor',
      ticker: 'AAPL',
      side: 'buy' as const,
      quantity: 5,
      order_type: 'market' as const,
      reason: 'RSI oversold',
      strategy_name: 'rsi_momentum',
      signal_strength: 0.75,
    };
    const inserted = { id: 'uuid-1', status: 'pending', ...rec };
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
        }),
      }),
    });

    const result = await createRecommendation(rec);
    expect(result.status).toBe('pending');
    expect(result.ticker).toBe('AAPL');
  });

  it('throws on Supabase error', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });
    await expect(createRecommendation({
      agent_role: 'execution_monitor', ticker: 'AAPL', side: 'buy',
      quantity: 1, order_type: 'market', reason: 'test',
    })).rejects.toThrow('DB error');
  });
});

describe('atomicApprove', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the row when update succeeds (status was pending)', async () => {
    const updated = { id: 'uuid-1', status: 'approved', ticker: 'AAPL' };
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updated, error: null }),
            }),
          }),
        }),
      }),
    });
    const result = await atomicApprove('uuid-1');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('approved');
  });

  it('returns null when row was not pending (0 rows updated)', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      }),
    });
    const result = await atomicApprove('uuid-1');
    expect(result).toBeNull();
  });
});

describe('createAlert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts alert and returns it', async () => {
    const alert = { id: 'alt-1', severity: 'warning', title: 'Test', message: 'msg', ticker: null, acknowledged: false, created_at: '' };
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: alert, error: null }),
        }),
      }),
    });
    const result = await createAlert({ severity: 'warning', title: 'Test', message: 'msg' });
    expect(result.severity).toBe('warning');
  });
});
