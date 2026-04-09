// apps/agents/tests/recommendations-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase client
const mockFrom = vi.fn();
vi.mock('../src/supabase-client.js', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

const {
  createRecommendation,
  listRecommendations,
  getRecommendation,
  atomicApprove,
  rejectRecommendation,
  markFilled,
  markRiskBlocked,
  createAlert,
  listAlerts,
} = await import('../src/recommendations-store.js');

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
    await expect(
      createRecommendation({
        agent_role: 'execution_monitor',
        ticker: 'AAPL',
        side: 'buy',
        quantity: 1,
        order_type: 'market',
        reason: 'test',
      }),
    ).rejects.toThrow('DB error');
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
    const alert = {
      id: 'alt-1',
      severity: 'warning',
      title: 'Test',
      message: 'msg',
      ticker: null,
      acknowledged: false,
      created_at: '',
    };
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

describe('listRecommendations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries agent_recommendations and returns an array', async () => {
    const rows = [
      { id: 'uuid-1', status: 'pending', ticker: 'AAPL' },
      { id: 'uuid-2', status: 'approved', ticker: 'TSLA' },
    ];
    const limitMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    mockFrom.mockReturnValue({ select: selectMock });

    const result = await listRecommendations();
    expect(mockFrom).toHaveBeenCalledWith('agent_recommendations');
    expect(result).toHaveLength(2);
    expect(result[0].ticker).toBe('AAPL');
  });

  it('filters by status when provided', async () => {
    const rows = [{ id: 'uuid-3', status: 'pending', ticker: 'MSFT' }];
    const eqMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    const limitMock = vi.fn().mockReturnValue({ eq: eqMock });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    mockFrom.mockReturnValue({ select: selectMock });

    const result = await listRecommendations('pending');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('pending');
  });
});

describe('getRecommendation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the row when found', async () => {
    const rec = { id: 'uuid-1', status: 'pending', ticker: 'AAPL' };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: rec, error: null }),
        }),
      }),
    });

    const result = await getRecommendation('uuid-1');
    expect(mockFrom).toHaveBeenCalledWith('agent_recommendations');
    expect(result).not.toBeNull();
    expect(result?.ticker).toBe('AAPL');
  });

  it('returns null on PGRST116 (not found)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    });

    const result = await getRecommendation('nonexistent');
    expect(result).toBeNull();
  });
});

describe('markFilled', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates status to filled with the order_id', async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ update: updateMock });

    await markFilled('uuid-1', 'order-abc');

    expect(mockFrom).toHaveBeenCalledWith('agent_recommendations');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'filled', order_id: 'order-abc' }),
    );
    expect(eqMock).toHaveBeenCalledWith('id', 'uuid-1');
  });

  it('throws on Supabase error', async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'update failed' } });
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: eqMock }),
    });

    await expect(markFilled('uuid-1', 'order-abc')).rejects.toThrow('update failed');
  });
});

describe('markRiskBlocked', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates status to risk_blocked with metadata.block_reason', async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ update: updateMock });

    await markRiskBlocked('uuid-1', 'exceeds max position size');

    expect(mockFrom).toHaveBeenCalledWith('agent_recommendations');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'risk_blocked',
        metadata: { block_reason: 'exceeds max position size' },
      }),
    );
    expect(eqMock).toHaveBeenCalledWith('id', 'uuid-1');
  });

  it('throws on Supabase error', async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'block failed' } });
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: eqMock }),
    });

    await expect(markRiskBlocked('uuid-1', 'reason')).rejects.toThrow('block failed');
  });
});

describe('listAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  // Helper to build the Supabase mock chain for listAlerts
  // Chain: from → select → order(created_at) → order(id) → [or →] limit
  function mockAlertQuery(data: unknown[] | null, error: { message: string } | null = null) {
    const limitMock = vi.fn().mockResolvedValue({ data, error });
    const orMock = vi.fn().mockReturnValue({ limit: limitMock });
    const order2Mock = vi.fn().mockReturnValue({ or: orMock, limit: limitMock });
    const order1Mock = vi.fn().mockReturnValue({ order: order2Mock });
    const selectMock = vi.fn().mockReturnValue({ order: order1Mock });
    mockFrom.mockReturnValue({ select: selectMock });
    return { selectMock, order1Mock, order2Mock, limitMock, orMock };
  }

  it('returns alerts page with nextCursor when more rows exist', async () => {
    // 3 rows returned = 2 + 1 extra → hasMore=true, nextCursor set
    const rows = [
      {
        id: 'alt-1',
        severity: 'warning',
        title: 'Alert 1',
        message: 'msg1',
        acknowledged: false,
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'alt-2',
        severity: 'critical',
        title: 'Alert 2',
        message: 'msg2',
        acknowledged: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'alt-3',
        severity: 'info',
        title: 'Alert 3',
        message: 'msg3',
        acknowledged: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    mockAlertQuery(rows);

    const result = await listAlerts(2);
    expect(mockFrom).toHaveBeenCalledWith('agent_alerts');
    expect(result.alerts).toHaveLength(2);
    expect(result.alerts[0].severity).toBe('warning');
    expect(result.nextCursor).toEqual({
      lastCreatedAt: '2026-01-01T00:00:00Z',
      lastId: 'alt-2',
    });
  });

  it('returns null nextCursor on last page', async () => {
    // Only 1 row (limit=2 → fetch 3, got 1 → no more)
    const rows = [
      {
        id: 'alt-1',
        severity: 'info',
        title: 'Alert 1',
        message: 'msg1',
        acknowledged: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    mockAlertQuery(rows);

    const result = await listAlerts(2);
    expect(result.alerts).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('returns empty page when no alerts exist', async () => {
    mockAlertQuery(null);
    const result = await listAlerts();
    expect(result.alerts).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('fetches limit+1 rows for has-more detection', async () => {
    const { limitMock } = mockAlertQuery([]);
    await listAlerts(25);
    expect(limitMock).toHaveBeenCalledWith(26); // 25 + 1
  });

  it('defaults to limit 50 (fetches 51)', async () => {
    const { limitMock } = mockAlertQuery([]);
    await listAlerts();
    expect(limitMock).toHaveBeenCalledWith(51); // 50 + 1
  });

  it('applies cursor filter via .or() when cursor provided', async () => {
    const { orMock } = mockAlertQuery([]);
    const cursor = { lastCreatedAt: '2026-01-01T00:00:00Z', lastId: 'alt-1' };
    await listAlerts(50, cursor);
    expect(orMock).toHaveBeenCalledWith(
      'created_at.lt.2026-01-01T00:00:00Z,and(created_at.eq.2026-01-01T00:00:00Z,id.lt.alt-1)',
    );
  });

  it('throws on Supabase error', async () => {
    mockAlertQuery(null, { message: 'query failed' });
    await expect(listAlerts()).rejects.toThrow('query failed');
  });
});

describe('rejectRecommendation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('atomically rejects a pending recommendation', async () => {
    const rejected = {
      id: 'uuid-1',
      status: 'rejected',
      ticker: 'AAPL',
      reviewed_at: '2026-03-26T10:00:00Z',
    };
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: rejected, error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await rejectRecommendation('uuid-1');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('rejected');
  });

  it('returns null when recommendation was not pending', async () => {
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

    const result = await rejectRecommendation('uuid-1');
    expect(result).toBeNull();
  });

  it('throws on non-PGRST116 Supabase error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({
                  data: null,
                  error: { code: 'OTHER', message: 'reject failed' },
                }),
            }),
          }),
        }),
      }),
    });

    await expect(rejectRecommendation('uuid-1')).rejects.toThrow('reject failed');
  });
});

describe('Edge Cases and Data Integrity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createRecommendation handles all optional fields', async () => {
    const rec = {
      agent_role: 'strategy_analyst',
      ticker: 'TSLA',
      side: 'sell' as const,
      quantity: 10,
      order_type: 'limit' as const,
      limit_price: 250.5,
      reason: 'Technical resistance',
      strategy_name: 'breakout',
      signal_strength: 0.92,
      metadata: { rsi: 75, volume: 'high' },
    };
    const inserted = {
      id: 'uuid-2',
      status: 'pending',
      created_at: '2026-03-26T10:00:00Z',
      ...rec,
    };
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
        }),
      }),
    });

    const result = await createRecommendation(rec);
    expect(result.limit_price).toBe(250.5);
    expect(result.signal_strength).toBe(0.92);
    expect(result.metadata).toEqual({ rsi: 75, volume: 'high' });
  });

  it('createRecommendation handles minimal required fields', async () => {
    const rec = {
      agent_role: 'risk_monitor',
      ticker: 'NVDA',
      side: 'buy' as const,
      quantity: 1,
      order_type: 'market' as const,
    };
    const inserted = {
      id: 'uuid-3',
      status: 'pending',
      created_at: '2026-03-26T11:00:00Z',
      ...rec,
    };
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
        }),
      }),
    });

    const result = await createRecommendation(rec);
    expect(result.ticker).toBe('NVDA');
    expect(result.status).toBe('pending');
  });

  it('listRecommendations handles "all" status filter', async () => {
    const rows = [
      { id: 'uuid-1', status: 'pending', ticker: 'AAPL' },
      { id: 'uuid-2', status: 'approved', ticker: 'MSFT' },
      { id: 'uuid-3', status: 'rejected', ticker: 'TSLA' },
    ];
    const limitMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    mockFrom.mockReturnValue({ select: selectMock });

    const result = await listRecommendations('all');
    expect(result).toHaveLength(3);
  });

  it('getRecommendation throws on non-PGRST116 error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi
            .fn()
            .mockResolvedValue({
              data: null,
              error: { code: 'OTHER', message: 'permission denied' },
            }),
        }),
      }),
    });

    await expect(getRecommendation('uuid-1')).rejects.toThrow('permission denied');
  });

  it('atomicApprove throws on non-PGRST116 error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({
                  data: null,
                  error: { code: 'OTHER', message: 'constraint violation' },
                }),
            }),
          }),
        }),
      }),
    });

    await expect(atomicApprove('uuid-1')).rejects.toThrow('constraint violation');
  });

  it('createAlert handles all severity levels', async () => {
    const severities: Array<'info' | 'warning' | 'critical'> = ['info', 'warning', 'critical'];

    for (const severity of severities) {
      const alert = {
        id: `alt-${severity}`,
        severity,
        title: `${severity} alert`,
        message: 'Test message',
        acknowledged: false,
        created_at: '',
      };
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: alert, error: null }),
          }),
        }),
      });

      const result = await createAlert({
        severity,
        title: `${severity} alert`,
        message: 'Test message',
      });
      expect(result.severity).toBe(severity);
    }
  });

  it('createAlert handles optional ticker field', async () => {
    const alert = {
      id: 'alt-with-ticker',
      severity: 'warning',
      title: 'Price Alert',
      message: 'AAPL dropped 5%',
      ticker: 'AAPL',
      acknowledged: false,
      created_at: '',
    };
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: alert, error: null }),
        }),
      }),
    });

    const result = await createAlert({
      severity: 'warning',
      title: 'Price Alert',
      message: 'AAPL dropped 5%',
      ticker: 'AAPL',
    });
    expect(result.ticker).toBe('AAPL');
  });

  it('createAlert throws on Supabase error', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }),
        }),
      }),
    });

    await expect(
      createAlert({ severity: 'info', title: 'Test', message: 'Test message' }),
    ).rejects.toThrow('insert failed');
  });
});

describe('Race Condition Prevention', () => {
  beforeEach(() => vi.clearAllMocks());

  it('atomicApprove prevents double-approval via status check', async () => {
    // First approval succeeds
    const approved = {
      id: 'uuid-1',
      status: 'approved',
      ticker: 'AAPL',
      reviewed_at: '2026-03-26T10:00:00Z',
    };
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: approved, error: null }),
            }),
          }),
        }),
      }),
    });

    const result1 = await atomicApprove('uuid-1');
    expect(result1?.status).toBe('approved');

    // Second approval attempt returns null (no rows matched pending status)
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

    const result2 = await atomicApprove('uuid-1');
    expect(result2).toBeNull();
  });

  it('rejectRecommendation prevents double-rejection via status check', async () => {
    // First rejection succeeds
    const rejected = {
      id: 'uuid-1',
      status: 'rejected',
      ticker: 'AAPL',
      reviewed_at: '2026-03-26T10:00:00Z',
    };
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: rejected, error: null }),
            }),
          }),
        }),
      }),
    });

    const result1 = await rejectRecommendation('uuid-1');
    expect(result1?.status).toBe('rejected');

    // Second rejection attempt returns null
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

    const result2 = await rejectRecommendation('uuid-1');
    expect(result2).toBeNull();
  });

  it('atomicApprove and rejectRecommendation cannot both succeed', async () => {
    // Approval succeeds first
    const approved = {
      id: 'uuid-1',
      status: 'approved',
      ticker: 'AAPL',
      reviewed_at: '2026-03-26T10:00:00Z',
    };
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: approved, error: null }),
            }),
          }),
        }),
      }),
    });

    const approveResult = await atomicApprove('uuid-1');
    expect(approveResult?.status).toBe('approved');

    // Rejection attempt fails (status no longer pending)
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

    const rejectResult = await rejectRecommendation('uuid-1');
    expect(rejectResult).toBeNull();
  });
});

describe('Timestamp and Metadata Handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('atomicApprove sets reviewed_at timestamp', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: { id: 'uuid-1', status: 'approved' }, error: null }),
          }),
        }),
      }),
    });
    mockFrom.mockReturnValue({ update: updateMock });

    await atomicApprove('uuid-1');

    const updateCall = updateMock.mock.calls[0][0];
    expect(updateCall.reviewed_at).toBeDefined();
    expect(typeof updateCall.reviewed_at).toBe('string');
  });

  it('rejectRecommendation sets reviewed_at timestamp', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: { id: 'uuid-1', status: 'rejected' }, error: null }),
          }),
        }),
      }),
    });
    mockFrom.mockReturnValue({ update: updateMock });

    await rejectRecommendation('uuid-1');

    const updateCall = updateMock.mock.calls[0][0];
    expect(updateCall.reviewed_at).toBeDefined();
    expect(typeof updateCall.reviewed_at).toBe('string');
  });

  it('markRiskBlocked sets reviewed_at and metadata', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValue({ update: updateMock });

    await markRiskBlocked('uuid-1', 'Portfolio limit exceeded');

    const updateCall = updateMock.mock.calls[0][0];
    expect(updateCall.reviewed_at).toBeDefined();
    expect(updateCall.metadata).toEqual({ block_reason: 'Portfolio limit exceeded' });
  });
});
