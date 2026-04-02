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

const { ShadowTracker } = await import('../../src/experiment/shadow-tracker.js');

// ---------------------------------------------------------------------------
// Tests: recordShadowFill
// ---------------------------------------------------------------------------

describe('ShadowTracker', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('recordShadowFill', () => {
    it('inserts a shadow order and returns the ID', async () => {
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'shadow-1' },
              error: null,
            }),
          }),
        }),
      });

      const tracker = new ShadowTracker('exp-1');
      const id = await tracker.recordShadowFill({
        recommendationId: 'rec-1',
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        marketPrice: 150,
      });

      expect(id).toBe('shadow-1');
      expect(mockFrom).toHaveBeenCalledWith('experiment_orders');
    });

    it('throws on insert error', async () => {
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB write failed' },
            }),
          }),
        }),
      });

      const tracker = new ShadowTracker('exp-1');

      await expect(
        tracker.recordShadowFill({
          recommendationId: 'rec-1',
          symbol: 'AAPL',
          side: 'buy',
          quantity: 10,
          marketPrice: 150,
        }),
      ).rejects.toThrow('Failed to record shadow fill');
    });

    it('uses default order_type of market', async () => {
      const insertFn = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'shadow-2' }, error: null }),
        }),
      });
      mockFrom.mockReturnValue({ insert: insertFn });

      const tracker = new ShadowTracker('exp-1');
      await tracker.recordShadowFill({
        recommendationId: 'rec-1',
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        marketPrice: 150,
      });

      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          order_type: 'market',
          is_shadow: true,
          phase: 'week1_shadow',
          status: 'filled',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Tests: getShadowPositions
  // ---------------------------------------------------------------------------

  describe('getShadowPositions', () => {
    it('returns aggregated positions from shadow orders', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { symbol: 'AAPL', side: 'buy', quantity: 10, fill_price: 150 },
                  { symbol: 'AAPL', side: 'buy', quantity: 5, fill_price: 155 },
                  { symbol: 'GOOG', side: 'buy', quantity: 3, fill_price: 2800 },
                ],
                error: null,
              }),
            }),
          }),
        }),
      });

      const tracker = new ShadowTracker('exp-1');
      const positions = await tracker.getShadowPositions();

      expect(positions.size).toBe(2);
      expect(positions.get('AAPL')).toEqual(
        expect.objectContaining({
          quantity: 15,
          side: 'long',
        }),
      );
      expect(positions.get('GOOG')).toEqual(
        expect.objectContaining({
          quantity: 3,
          side: 'long',
        }),
      );
    });

    it('returns empty map on error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'DB error' },
              }),
            }),
          }),
        }),
      });

      const tracker = new ShadowTracker('exp-1');
      const positions = await tracker.getShadowPositions();

      expect(positions.size).toBe(0);
    });

    it('excludes symbols with zero net position', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { symbol: 'AAPL', side: 'buy', quantity: 10, fill_price: 150 },
                  { symbol: 'AAPL', side: 'sell', quantity: 10, fill_price: 160 },
                ],
                error: null,
              }),
            }),
          }),
        }),
      });

      const tracker = new ShadowTracker('exp-1');
      const positions = await tracker.getShadowPositions();

      expect(positions.size).toBe(0);
    });

    it('handles short positions correctly', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { symbol: 'TSLA', side: 'sell', quantity: 20, fill_price: 200 },
                  { symbol: 'TSLA', side: 'buy', quantity: 5, fill_price: 195 },
                ],
                error: null,
              }),
            }),
          }),
        }),
      });

      const tracker = new ShadowTracker('exp-1');
      const positions = await tracker.getShadowPositions();

      expect(positions.get('TSLA')).toEqual(
        expect.objectContaining({
          quantity: 15,
          side: 'short',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Tests: calculateShadowEquity
  // ---------------------------------------------------------------------------

  describe('calculateShadowEquity', () => {
    it('calculates equity from initial capital and orders', async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'experiments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { initial_capital: 100000 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'experiment_orders') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [{ symbol: 'AAPL', side: 'buy', quantity: 10, fill_price: 150 }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const tracker = new ShadowTracker('exp-1');
      const prices = new Map([['AAPL', 160]]); // Current price $160
      const equity = await tracker.calculateShadowEquity(prices);

      // Cash: 100000 - (10 * 150) = 98500
      // Positions: 10 * 160 = 1600
      // Equity: 98500 + 1600 = 100100
      expect(equity.cash).toBe(98500);
      expect(equity.positionsValue).toBe(1600);
      expect(equity.equity).toBe(100100);
    });

    it('returns zero equity on experiment fetch failure', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'not found' },
            }),
          }),
        }),
      });

      const tracker = new ShadowTracker('exp-1');
      const equity = await tracker.calculateShadowEquity(new Map());

      expect(equity.equity).toBe(0);
      expect(equity.cash).toBe(0);
    });

    it('returns initial capital when no orders exist', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'experiments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { initial_capital: 100000 },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      });

      const tracker = new ShadowTracker('exp-1');
      const equity = await tracker.calculateShadowEquity(new Map());

      expect(equity.equity).toBe(100000);
      expect(equity.cash).toBe(100000);
      expect(equity.positionsValue).toBe(0);
      expect(equity.unrealizedPnl).toBe(0);
    });
  });
});
