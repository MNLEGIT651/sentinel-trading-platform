// apps/agents/tests/engine-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EngineClient } from '../src/engine-client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

describe('EngineClient new methods', () => {
  let client: EngineClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new EngineClient('http://engine:8000', 'test-key');
  });

  it('getAccount fetches /api/v1/portfolio/account', async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ cash: 95000, equity: 100000, positions_value: 5000, initial_capital: 100000 }),
    );
    const acct = await client.getAccount();
    expect(acct.equity).toBe(100000);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://engine:8000/api/v1/portfolio/account',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('getPositions fetches /api/v1/portfolio/positions', async () => {
    mockFetch.mockResolvedValue(
      mockResponse([{ instrument_id: 'AAPL', quantity: 10, avg_price: 180 }]),
    );
    const positions = await client.getPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].instrument_id).toBe('AAPL');
  });

  it('submitOrder posts to /api/v1/portfolio/orders', async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ order_id: 'ord-1', status: 'filled', fill_price: 180.5 }),
    );
    const result = await client.submitOrder({
      symbol: 'AAPL',
      side: 'buy',
      order_type: 'market',
      quantity: 5,
    });
    expect(result.order_id).toBe('ord-1');
  });

  it('submitOrder throws on 422 risk block', async () => {
    mockFetch.mockResolvedValue(mockResponse({ detail: 'Risk check blocked order' }, 422));
    await expect(
      client.submitOrder({ symbol: 'AAPL', side: 'buy', order_type: 'market', quantity: 5000 }),
    ).rejects.toThrow('422');
  });

  it('scanStrategies posts to /api/v1/strategies/scan', async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        signals: [],
        total_signals: 0,
        tickers_scanned: 2,
        strategies_run: 8,
        errors: [],
      }),
    );
    const result = await client.scanStrategies(['AAPL', 'MSFT']);
    expect(result.tickers_scanned).toBe(2);
  });

  it('getQuotes fetches /api/v1/data/quotes', async () => {
    mockFetch.mockResolvedValue(mockResponse([{ ticker: 'SPY', close: 450, change_pct: 0.5 }]));
    const quotes = await client.getQuotes(['SPY']);
    expect(quotes[0].ticker).toBe('SPY');
    expect(quotes[0].change_pct).toBe(0.5);
  });

  it('preTradeCheck posts to /api/v1/risk/pre-trade-check', async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ allowed: true, action: 'allow', reason: 'ok', adjusted_shares: null }),
    );
    const result = await client.preTradeCheck({
      ticker: 'AAPL',
      shares: 5,
      price: 180,
      side: 'buy',
      equity: 100000,
      cash: 95000,
      peak_equity: 100000,
      daily_starting_equity: 100000,
      positions: {},
      position_sectors: {},
    });
    expect(result.allowed).toBe(true);
  });
});
