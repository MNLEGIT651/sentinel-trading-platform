import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('../src/supabase-client.js', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

vi.mock('../src/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { evaluateAutoExecution, fetchActivePolicy, fetchSystemControls, logAutoExecutionDecision } =
  await import('../src/auto-execution.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    autonomy_mode: 'auto_execute',
    version: 1,
    max_position_pct: 5,
    ...overrides,
  };
}

function makeSystemControls(overrides: Record<string, unknown> = {}) {
  return { trading_halted: false, ...overrides };
}

function makeRecommendation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    signal_strength: 0.85,
    quantity: 10,
    price: 150,
    ticker: 'AAPL',
    strategy_name: 'momentum',
    ...overrides,
  };
}

/** Wire up the chain mock for common Supabase query patterns. */
function mockSupabaseChain(returnData: unknown, opts: { error?: unknown; count?: number } = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: returnData, error: opts.error ?? null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: returnData, error: opts.error ?? null });
  chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
  // For count queries (isDailyLimitExceeded)
  if (opts.count !== undefined) {
    chain.select = vi.fn().mockReturnValue({
      ...chain,
      eq: vi.fn().mockReturnValue({
        ...chain,
        eq: vi.fn().mockReturnValue({
          ...chain,
          gte: vi.fn().mockResolvedValue({ count: opts.count, error: null }),
        }),
        gte: vi.fn().mockResolvedValue({ count: opts.count, error: null }),
      }),
      gte: vi.fn().mockResolvedValue({ count: opts.count, error: null }),
    });
  }
  return chain;
}

// ---------------------------------------------------------------------------
// Tests: evaluateAutoExecution
// ---------------------------------------------------------------------------

describe('evaluateAutoExecution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approves when all checks pass', async () => {
    // Strategy check: strategy with auto_execute mode
    const strategyChain = mockSupabaseChain({ name: 'momentum', autonomy_mode: 'auto_execute' });
    // Universe restriction check: no restrictions
    const universeChain = mockSupabaseChain(null);
    universeChain.select = vi.fn().mockReturnValue(universeChain);
    universeChain.eq = vi.fn().mockReturnValue(universeChain);
    (universeChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      error: null,
    });
    // Daily limit check: 0 trades today
    const dailyChain = mockSupabaseChain(null, { count: 0 });

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'strategies') return strategyChain;
      if (table === 'universe_restrictions') return universeChain;
      if (table === 'recommendation_events') {
        callCount++;
        return dailyChain;
      }
      return mockSupabaseChain(null);
    });

    const result = await evaluateAutoExecution(
      makeRecommendation(),
      makePolicy(),
      makeSystemControls(),
    );

    expect(result.canAutoExecute).toBe(true);
    expect(result.reason).toContain('All auto-execution policy checks passed');
    expect(result.checks.haltStatus).toBe(true);
    expect(result.checks.signalStrength).toBe(true);
    expect(result.checks.positionSize).toBe(true);
  });

  it('blocks when autonomy mode is not auto_execute or auto_approve', async () => {
    const result = await evaluateAutoExecution(
      makeRecommendation(),
      makePolicy({ autonomy_mode: 'suggest' }),
      makeSystemControls(),
    );

    expect(result.canAutoExecute).toBe(false);
    expect(result.reason).toContain("'suggest' does not permit auto-execution");
  });

  it('blocks when trading is halted', async () => {
    const result = await evaluateAutoExecution(
      makeRecommendation(),
      makePolicy(),
      makeSystemControls({ trading_halted: true }),
    );

    expect(result.canAutoExecute).toBe(false);
    expect(result.reason).toBe('Trading is currently halted');
    expect(result.checks.haltStatus).toBe(false);
  });

  it('blocks when signal strength is below threshold', async () => {
    // Mock strategy and universe to pass
    const strategyChain = mockSupabaseChain({ name: 'momentum', autonomy_mode: 'auto_execute' });
    const universeChain = mockSupabaseChain(null);
    universeChain.select = vi.fn().mockReturnValue(universeChain);
    universeChain.eq = vi.fn().mockReturnValue(universeChain);
    (universeChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'strategies') return strategyChain;
      if (table === 'universe_restrictions') return universeChain;
      return mockSupabaseChain(null);
    });

    const result = await evaluateAutoExecution(
      makeRecommendation({ signal_strength: 0.3 }),
      makePolicy(),
      makeSystemControls(),
    );

    expect(result.canAutoExecute).toBe(false);
    expect(result.reason).toContain('below threshold');
    expect(result.checks.signalStrength).toBe(false);
  });

  it('blocks when position value exceeds limit', async () => {
    const strategyChain = mockSupabaseChain({ name: 'momentum', autonomy_mode: 'auto_execute' });
    const universeChain = mockSupabaseChain(null);
    universeChain.select = vi.fn().mockReturnValue(universeChain);
    universeChain.eq = vi.fn().mockReturnValue(universeChain);
    (universeChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'strategies') return strategyChain;
      if (table === 'universe_restrictions') return universeChain;
      return mockSupabaseChain(null);
    });

    // quantity 500 * price 200 = $100,000 which exceeds $50,000 default
    const result = await evaluateAutoExecution(
      makeRecommendation({ quantity: 500, price: 200, signal_strength: 0.9 }),
      makePolicy(),
      makeSystemControls(),
    );

    expect(result.canAutoExecute).toBe(false);
    expect(result.reason).toContain('exceeds auto-execution limit');
    expect(result.checks.positionSize).toBe(false);
  });

  it('blocks when strategy autonomy mode is disabled', async () => {
    const strategyChain = mockSupabaseChain({ name: 'momentum', autonomy_mode: 'disabled' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'strategies') return strategyChain;
      return mockSupabaseChain(null);
    });

    const result = await evaluateAutoExecution(
      makeRecommendation(),
      makePolicy(),
      makeSystemControls(),
    );

    expect(result.canAutoExecute).toBe(false);
    expect(result.reason).toContain("autonomy mode 'disabled'");
  });

  it('blocks when ticker is blacklisted', async () => {
    const strategyChain = mockSupabaseChain({ name: 'momentum', autonomy_mode: 'auto_execute' });
    const universeChain = mockSupabaseChain(null);
    universeChain.select = vi.fn().mockReturnValue(universeChain);
    universeChain.eq = vi.fn().mockReturnValue(universeChain);
    (universeChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ restriction_type: 'blacklist', symbols: ['AAPL', 'TSLA'] }],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'strategies') return strategyChain;
      if (table === 'universe_restrictions') return universeChain;
      return mockSupabaseChain(null);
    });

    const result = await evaluateAutoExecution(
      makeRecommendation({ ticker: 'AAPL' }),
      makePolicy(),
      makeSystemControls(),
    );

    expect(result.canAutoExecute).toBe(false);
    expect(result.reason).toContain('blacklisted');
  });

  it('blocks when ticker is not in any whitelist', async () => {
    const strategyChain = mockSupabaseChain({ name: 'momentum', autonomy_mode: 'auto_execute' });
    const universeChain = mockSupabaseChain(null);
    universeChain.select = vi.fn().mockReturnValue(universeChain);
    universeChain.eq = vi.fn().mockReturnValue(universeChain);
    (universeChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ restriction_type: 'whitelist', symbols: ['MSFT', 'GOOG'] }],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'strategies') return strategyChain;
      if (table === 'universe_restrictions') return universeChain;
      return mockSupabaseChain(null);
    });

    const result = await evaluateAutoExecution(
      makeRecommendation({ ticker: 'AAPL' }),
      makePolicy(),
      makeSystemControls(),
    );

    expect(result.canAutoExecute).toBe(false);
    expect(result.reason).toContain('not in any active whitelist');
  });

  it('allows auto_approve mode', async () => {
    const strategyChain = mockSupabaseChain(null); // no strategy in DB — allowed
    const universeChain = mockSupabaseChain(null);
    universeChain.select = vi.fn().mockReturnValue(universeChain);
    universeChain.eq = vi.fn().mockReturnValue(universeChain);
    (universeChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });
    const dailyChain = mockSupabaseChain(null, { count: 0 });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'strategies') return strategyChain;
      if (table === 'universe_restrictions') return universeChain;
      if (table === 'recommendation_events') return dailyChain;
      return mockSupabaseChain(null);
    });

    const result = await evaluateAutoExecution(
      makeRecommendation({ strategy_name: null }),
      makePolicy({ autonomy_mode: 'auto_approve' }),
      makeSystemControls(),
    );

    expect(result.canAutoExecute).toBe(true);
  });

  it('uses null signal_strength as 0', async () => {
    const strategyChain = mockSupabaseChain({ name: 'momentum', autonomy_mode: 'auto_execute' });
    const universeChain = mockSupabaseChain(null);
    universeChain.select = vi.fn().mockReturnValue(universeChain);
    universeChain.eq = vi.fn().mockReturnValue(universeChain);
    (universeChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'strategies') return strategyChain;
      if (table === 'universe_restrictions') return universeChain;
      return mockSupabaseChain(null);
    });

    const result = await evaluateAutoExecution(
      makeRecommendation({ signal_strength: null }),
      makePolicy(),
      makeSystemControls(),
    );

    expect(result.canAutoExecute).toBe(false);
    expect(result.reason).toContain('below threshold');
  });
});

// ---------------------------------------------------------------------------
// Tests: fetchActivePolicy
// ---------------------------------------------------------------------------

describe('fetchActivePolicy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the active policy from Supabase', async () => {
    const policyData = { autonomy_mode: 'auto_execute', version: 3, max_position_pct: 5 };
    const chain = mockSupabaseChain(policyData);
    mockFrom.mockReturnValue(chain);

    const result = await fetchActivePolicy();
    expect(result).toEqual(policyData);
  });

  it('returns null when no active policy exists', async () => {
    const chain = mockSupabaseChain(null, { error: { message: 'not found' } });
    mockFrom.mockReturnValue(chain);

    const result = await fetchActivePolicy();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: fetchSystemControls
// ---------------------------------------------------------------------------

describe('fetchSystemControls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns system controls from Supabase', async () => {
    const controlsData = { trading_halted: false, live_execution_enabled: true };
    const chain = mockSupabaseChain(controlsData);
    mockFrom.mockReturnValue(chain);

    const result = await fetchSystemControls();
    expect(result).toEqual(controlsData);
  });

  it('returns safe halted default on error', async () => {
    const chain = mockSupabaseChain(null, { error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    const result = await fetchSystemControls();
    expect(result).toEqual({ trading_halted: true });
  });
});

// ---------------------------------------------------------------------------
// Tests: logAutoExecutionDecision
// ---------------------------------------------------------------------------

describe('logAutoExecutionDecision', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts an auto_approved event', async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: insertFn });

    await logAutoExecutionDecision('rec-1', {
      canAutoExecute: true,
      reason: 'All checks passed',
      policyVersion: 1,
      checks: {
        autonomyMode: 'auto_execute',
        strategyAutonomy: true,
        universeRestriction: true,
        signalStrength: true,
        positionSize: true,
        dailyLimit: true,
        haltStatus: true,
      },
    });

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendation_id: 'rec-1',
        event_type: 'auto_approved',
        actor_type: 'policy',
      }),
    );
  });

  it('inserts an auto_execution_denied event when blocked', async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: insertFn });

    await logAutoExecutionDecision('rec-2', {
      canAutoExecute: false,
      reason: 'Trading halted',
      policyVersion: 1,
      checks: {
        autonomyMode: 'auto_execute',
        strategyAutonomy: false,
        universeRestriction: false,
        signalStrength: false,
        positionSize: false,
        dailyLimit: false,
        haltStatus: false,
      },
    });

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'auto_execution_denied',
      }),
    );
  });

  it('does not throw on insert failure', async () => {
    const insertFn = vi.fn().mockRejectedValue(new Error('DB error'));
    mockFrom.mockReturnValue({ insert: insertFn });

    await expect(
      logAutoExecutionDecision('rec-3', {
        canAutoExecute: true,
        reason: 'ok',
        policyVersion: 1,
        checks: {
          autonomyMode: 'auto_execute',
          strategyAutonomy: true,
          universeRestriction: true,
          signalStrength: true,
          positionSize: true,
          dailyLimit: true,
          haltStatus: true,
        },
      }),
    ).resolves.toBeUndefined();
  });
});
