import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();

vi.mock('../../src/supabase-client.js', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

vi.mock('../../src/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { BoundedExecutor } = await import('../../src/experiment/bounded-executor.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_CAPS = {
  maxDailyTrades: 5,
  maxPositionValue: 10000,
  signalStrengthThreshold: 0.6,
  maxTotalExposure: 50000,
};

function makeRec(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    signal_strength: 0.8,
    quantity: 10,
    price: 150,
    ticker: 'AAPL',
    ...overrides,
  };
}

/** Build a deeply-chainable mock where every method returns the same chain. */
function chainMock(resolvedValue: Record<string, unknown>) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.in = vi.fn(self);
  chain.not = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  // Also make the chain itself a thenable for count queries
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(resolvedValue));
  // Override to make the chain awaitable
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolvedValue).then(resolve, reject),
  });
  return chain;
}

function mockDailyCount(count: number) {
  return chainMock({ count, error: null });
}

function mockExposureQuery(orders: Array<Record<string, unknown>>) {
  return chainMock({ data: orders, error: null });
}

function mockExposureError() {
  return chainMock({ data: null, error: { message: 'DB error' } });
}

// ---------------------------------------------------------------------------
// Tests: evaluate
// ---------------------------------------------------------------------------

describe('BoundedExecutor', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('evaluate', () => {
    it('allows when all checks pass', async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'experiment_orders') {
          callCount++;
          if (callCount === 1) return mockDailyCount(0); // daily count
          return mockExposureQuery([]); // total exposure
        }
        return {};
      });

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);
      const result = await executor.evaluate(makeRec());

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('all checks passed');
      expect(result.checks.signalStrength).toBe(true);
      expect(result.checks.positionValue).toBe(true);
      expect(result.checks.dailyLimit).toBe(true);
      expect(result.checks.totalExposure).toBe(true);
    });

    it('blocks when signal strength is below threshold', async () => {
      mockFrom.mockImplementation(() => mockDailyCount(0));

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);
      const result = await executor.evaluate(makeRec({ signal_strength: 0.3 }));

      expect(result.allowed).toBe(false);
      expect(result.checks.signalStrength).toBe(false);
      expect(result.reason).toContain('signal_strength');
    });

    it('blocks when position value exceeds max', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockDailyCount(0);
        return mockExposureQuery([]);
      });

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);
      // 100 shares * $200 = $20,000 > $10,000 cap
      const result = await executor.evaluate(makeRec({ quantity: 100, price: 200 }));

      expect(result.allowed).toBe(false);
      expect(result.checks.positionValue).toBe(false);
      expect(result.reason).toContain('position_value');
    });

    it('blocks when daily trade limit is reached', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockDailyCount(5); // at limit
        return mockExposureQuery([]);
      });

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);
      const result = await executor.evaluate(makeRec());

      expect(result.allowed).toBe(false);
      expect(result.checks.dailyLimit).toBe(false);
      expect(result.reason).toContain('daily_trades');
    });

    it('blocks when total exposure would exceed max', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockDailyCount(0);
        // Existing exposure: 100 shares * $450 = $45,000
        return mockExposureQuery([{ symbol: 'MSFT', side: 'buy', quantity: 100, fill_price: 450 }]);
      });

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);
      // New position: 10 * $150 = $1,500. Total = $46,500 which is under $50,000
      // But let's make it exceed: 100 * $150 = $15,000. Total = $60,000 > $50,000
      const result = await executor.evaluate(makeRec({ quantity: 100 }));

      expect(result.allowed).toBe(false);
      expect(result.checks.totalExposure).toBe(false);
      expect(result.reason).toContain('total_exposure');
    });

    it('treats null signal_strength as 0', async () => {
      mockFrom.mockImplementation(() => mockDailyCount(0));

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);
      const result = await executor.evaluate(makeRec({ signal_strength: null }));

      expect(result.checks.signalStrength).toBe(false);
    });

    it('treats null price as 0 for position value', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockDailyCount(0);
        return mockExposureQuery([]);
      });

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);
      const result = await executor.evaluate(makeRec({ price: null }));

      // qty * 0 = 0, so passes position and exposure checks
      expect(result.checks.positionValue).toBe(true);
    });

    it('aggregates net exposure across buy/sell orders', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockDailyCount(0);
        // Buy 100 AAPL @ $150, Sell 50 AAPL @ $160 => net 50 shares * $160 = $8,000
        return mockExposureQuery([
          { symbol: 'AAPL', side: 'buy', quantity: 100, fill_price: 150 },
          { symbol: 'AAPL', side: 'sell', quantity: 50, fill_price: 160 },
        ]);
      });

      const executor = new BoundedExecutor('exp-1', {
        ...DEFAULT_CAPS,
        maxTotalExposure: 10000,
      });
      // New: 10 * $150 = $1,500. Existing: $8,000. Total: $9,500 < $10,000
      const result = await executor.evaluate(makeRec());

      expect(result.checks.totalExposure).toBe(true);
    });

    it('reports multiple failures in reason string', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockDailyCount(10);
        return mockExposureQuery([]);
      });

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);
      const result = await executor.evaluate(
        makeRec({ signal_strength: 0.1, quantity: 200, price: 200 }),
      );

      expect(result.allowed).toBe(false);
      // Should contain multiple failure reasons joined by semicolons
      expect(result.reason).toContain(';');
    });
  });

  describe('recordExecution', () => {
    it('inserts into experiment_orders and returns ID', async () => {
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'order-1' }, error: null }),
          }),
        }),
      });

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);
      const id = await executor.recordExecution({
        recommendationId: 'rec-1',
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        orderType: 'market',
        brokerOrderId: 'broker-1',
        status: 'filled',
        fillPrice: 150,
        fillQuantity: 10,
      });

      expect(id).toBe('order-1');
      expect(mockFrom).toHaveBeenCalledWith('experiment_orders');
    });

    it('throws on insert error', async () => {
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'insert failed' },
            }),
          }),
        }),
      });

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);

      await expect(
        executor.recordExecution({
          recommendationId: 'rec-1',
          symbol: 'AAPL',
          side: 'buy',
          quantity: 10,
          orderType: 'market',
          status: 'filled',
        }),
      ).rejects.toThrow('Failed to record execution');
    });

    it('handles conservative fallback on daily count error', async () => {
      // When getTodayOrderCount fails, it returns maxDailyTrades (conservative)
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return chainMock({ count: null, error: { message: 'DB error' } });
        }
        return mockExposureQuery([]);
      });

      const executor = new BoundedExecutor('exp-1', DEFAULT_CAPS);
      const result = await executor.evaluate(makeRec());

      expect(result.checks.dailyLimit).toBe(false);
    });
  });
});
