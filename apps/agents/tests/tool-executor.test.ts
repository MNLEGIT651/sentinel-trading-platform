// apps/agents/tests/tool-executor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolExecutor } from '../src/tool-executor.js';

const mockEngine = {
  ingestData: vi.fn(),
  getQuotes: vi.fn(),
  scanStrategies: vi.fn(),
  getStrategies: vi.fn(),
  getAccount: vi.fn(),
  getPositions: vi.fn(),
  assessRisk: vi.fn(),
  calculatePositionSize: vi.fn(),
  preTradeCheck: vi.fn(),
  submitOrder: vi.fn(),
  getOpenOrders: vi.fn(),
};

vi.mock('../src/recommendations-store.js', () => ({
  createRecommendation: vi.fn().mockResolvedValue({ id: 'rec-1', status: 'pending' }),
  createAlert: vi.fn().mockResolvedValue({ id: 'alt-1' }),
}));

const executor = new ToolExecutor(mockEngine as any);

describe('get_market_data', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getQuotes and returns prices dict', async () => {
    mockEngine.ingestData.mockResolvedValue({ ingested: 2, errors: [] });
    mockEngine.getQuotes.mockResolvedValue([
      { ticker: 'AAPL', close: 180, change_pct: 0.5, volume: 1000000 },
      { ticker: 'MSFT', close: 370, change_pct: -0.2, volume: 500000 },
    ]);
    const result = JSON.parse(
      await executor.execute('get_market_data', { tickers: ['AAPL', 'MSFT'] }),
    );
    expect(result.prices['AAPL'].price).toBe(180);
    expect(result.prices['MSFT'].price).toBe(370);
  });

  it('still returns data when ingest fails', async () => {
    mockEngine.ingestData.mockRejectedValue(new Error('DB unavailable'));
    mockEngine.getQuotes.mockResolvedValue([
      { ticker: 'SPY', close: 450, change_pct: 0.1, volume: 5000000 },
    ]);
    const result = JSON.parse(await executor.execute('get_market_data', { tickers: ['SPY'] }));
    expect(result.prices['SPY'].price).toBe(450);
  });
});

describe('get_market_sentiment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns bullish when SPY change_pct > 0.3', async () => {
    mockEngine.getQuotes.mockResolvedValue([
      { ticker: 'SPY', close: 450, change_pct: 0.8 },
      { ticker: 'QQQ', close: 380, change_pct: 0.9 },
      { ticker: 'IWM', close: 200, change_pct: 0.5 },
    ]);
    const result = JSON.parse(await executor.execute('get_market_sentiment', {}));
    expect(result.overall).toBe('bullish');
    expect(result.drivers).toHaveLength(3);
  });

  it('returns bearish when SPY change_pct < -0.3', async () => {
    mockEngine.getQuotes.mockResolvedValue([{ ticker: 'SPY', close: 440, change_pct: -0.9 }]);
    const result = JSON.parse(await executor.execute('get_market_sentiment', {}));
    expect(result.overall).toBe('bearish');
  });

  it('returns neutral when SPY change_pct is between -0.3 and 0.3', async () => {
    mockEngine.getQuotes.mockResolvedValue([{ ticker: 'SPY', close: 445, change_pct: 0.1 }]);
    const result = JSON.parse(await executor.execute('get_market_sentiment', {}));
    expect(result.overall).toBe('neutral');
  });
});

describe('run_strategy_scan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls scanStrategies and returns signals', async () => {
    mockEngine.scanStrategies.mockResolvedValue({
      signals: [
        {
          ticker: 'NVDA',
          direction: 'long',
          strength: 0.82,
          strategy_name: 'rsi_momentum',
          reason: 'RSI oversold',
        },
      ],
      total_signals: 1,
      tickers_scanned: 1,
      strategies_run: 8,
      errors: [],
    });
    const result = JSON.parse(await executor.execute('run_strategy_scan', { tickers: ['NVDA'] }));
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].ticker).toBe('NVDA');
  });

  it('uses default watchlist when no tickers provided', async () => {
    mockEngine.scanStrategies.mockResolvedValue({
      signals: [],
      total_signals: 0,
      tickers_scanned: 8,
      strategies_run: 8,
      errors: [],
    });
    await executor.execute('run_strategy_scan', {});
    expect(mockEngine.scanStrategies).toHaveBeenCalledWith(
      expect.objectContaining({ tickers: expect.arrayContaining(['AAPL', 'MSFT', 'SPY']) }),
    );
  });
});

describe('assess_portfolio_risk', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches real account and positions before assessing risk', async () => {
    mockEngine.getAccount.mockResolvedValue({
      equity: 102000,
      cash: 97000,
      positions_value: 5000,
      initial_capital: 100000,
    });
    mockEngine.getPositions.mockResolvedValue([
      { instrument_id: 'AAPL', quantity: 10, market_value: 1800, avg_price: 180 },
    ]);
    mockEngine.assessRisk.mockResolvedValue({
      equity: 102000,
      drawdown: 0,
      daily_pnl: 2000,
      halted: false,
      alerts: [],
      concentrations: {},
    });

    const result = JSON.parse(await executor.execute('assess_portfolio_risk', {}));
    expect(result.equity).toBe(102000);
    expect(mockEngine.getAccount).toHaveBeenCalledTimes(1);
    expect(mockEngine.getPositions).toHaveBeenCalledTimes(1);
    expect(mockEngine.assessRisk).toHaveBeenCalledWith(
      expect.objectContaining({ equity: 102000, cash: 97000 }),
    );
  });
});

describe('check_risk_limits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns passed=false when pre-trade check blocks', async () => {
    mockEngine.getAccount.mockResolvedValue({
      equity: 100000,
      cash: 95000,
      initial_capital: 100000,
    });
    mockEngine.getPositions.mockResolvedValue([]);
    mockEngine.preTradeCheck.mockResolvedValue({
      allowed: false,
      action: 'block',
      reason: 'Exceeds position limit',
      adjusted_shares: null,
    });

    const result = JSON.parse(
      await executor.execute('check_risk_limits', {
        ticker: 'AAPL',
        shares: 10000,
        price: 180,
        side: 'buy',
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('position limit');
  });

  it('returns passed=true when trade is allowed', async () => {
    mockEngine.getAccount.mockResolvedValue({
      equity: 100000,
      cash: 95000,
      initial_capital: 100000,
    });
    mockEngine.getPositions.mockResolvedValue([]);
    mockEngine.preTradeCheck.mockResolvedValue({
      allowed: true,
      action: 'allow',
      reason: 'All checks passed',
      adjusted_shares: null,
    });

    const result = JSON.parse(
      await executor.execute('check_risk_limits', {
        ticker: 'AAPL',
        shares: 5,
        price: 180,
        side: 'buy',
      }),
    );
    expect(result.passed).toBe(true);
  });
});

describe('submit_order', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes pending recommendation to Supabase, does NOT call engine.submitOrder', async () => {
    const { createRecommendation } = await import('../src/recommendations-store.js');
    const result = JSON.parse(
      await executor.execute('submit_order', {
        ticker: 'AAPL',
        side: 'buy',
        quantity: 5,
        order_type: 'market',
      }),
    );
    expect(result.status).toBe('pending');
    expect(result.recommendation_id).toBe('rec-1');
    expect(mockEngine.submitOrder).not.toHaveBeenCalled();
    expect(createRecommendation).toHaveBeenCalled();
  });
});

describe('analyze_ticker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls scanStrategies for single ticker with min_strength=0', async () => {
    mockEngine.scanStrategies.mockResolvedValue({
      signals: [
        {
          ticker: 'AAPL',
          direction: 'long',
          strength: 0.7,
          strategy_name: 'sma_crossover',
          reason: 'Golden cross',
        },
        {
          ticker: 'AAPL',
          direction: 'short',
          strength: 0.4,
          strategy_name: 'rsi_momentum',
          reason: 'Overbought',
        },
      ],
      total_signals: 2,
      tickers_scanned: 1,
      strategies_run: 8,
      errors: [],
    });
    const result = JSON.parse(await executor.execute('analyze_ticker', { ticker: 'aapl' }));
    expect(result.ticker).toBe('AAPL');
    expect(result.summary.trend_bias).toBe('neutral'); // 1 long == 1 short → tie → neutral
    expect(result.summary.long_signals).toBe(1);
    expect(result.summary.short_signals).toBe(1);
    expect(mockEngine.scanStrategies).toHaveBeenCalledWith(
      expect.objectContaining({ tickers: ['AAPL'], min_strength: 0.0 }),
    );
  });
});

describe('get_strategy_info', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all strategies when no family filter is provided', async () => {
    mockEngine.getStrategies.mockResolvedValue({
      strategies: [
        { name: 'sma_crossover', family: 'trend', description: 'SMA crossover' },
        { name: 'rsi_momentum', family: 'momentum', description: 'RSI momentum' },
      ],
    });
    const result = JSON.parse(await executor.execute('get_strategy_info', {}));
    expect(result.strategies).toHaveLength(2);
    expect(mockEngine.getStrategies).toHaveBeenCalledTimes(1);
  });

  it('filters strategies by family when family is provided', async () => {
    mockEngine.getStrategies.mockResolvedValue({
      strategies: [
        { name: 'sma_crossover', family: 'trend', description: 'SMA crossover' },
        { name: 'rsi_momentum', family: 'momentum', description: 'RSI momentum' },
      ],
    });
    const result = JSON.parse(await executor.execute('get_strategy_info', { family: 'trend' }));
    expect(result.family).toBe('trend');
    expect(result.strategies).toHaveLength(1);
    expect(result.strategies[0].name).toBe('sma_crossover');
  });
});

describe('calculate_position_size', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches account equity and delegates to engine.calculatePositionSize', async () => {
    mockEngine.getAccount.mockResolvedValue({
      equity: 100000,
      cash: 90000,
      positions_value: 10000,
      initial_capital: 100000,
    });
    mockEngine.calculatePositionSize.mockResolvedValue({
      ticker: 'AAPL',
      shares: 27,
      position_value: 4860,
      fraction: 0.0486,
    });

    const result = JSON.parse(
      await executor.execute('calculate_position_size', {
        ticker: 'AAPL',
        price: 180,
        method: 'fixed_fraction',
      }),
    );

    expect(result.shares).toBe(27);
    expect(result.ticker).toBe('AAPL');
    expect(mockEngine.getAccount).toHaveBeenCalledTimes(1);
    expect(mockEngine.calculatePositionSize).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL', price: 180, equity: 100000 }),
    );
  });

  it('uses fixed_fraction method by default when no method provided', async () => {
    mockEngine.getAccount.mockResolvedValue({
      equity: 50000,
      cash: 40000,
      initial_capital: 50000,
    });
    mockEngine.calculatePositionSize.mockResolvedValue({
      ticker: 'MSFT',
      shares: 10,
      position_value: 3700,
      fraction: 0.074,
    });

    await executor.execute('calculate_position_size', { ticker: 'MSFT', price: 370 });

    expect(mockEngine.calculatePositionSize).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'fixed_fraction' }),
    );
  });
});

describe('get_open_orders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns orders and count from engine', async () => {
    mockEngine.getOpenOrders.mockResolvedValue([
      { order_id: 'o1', ticker: 'AAPL', side: 'buy', quantity: 5, status: 'pending' },
      { order_id: 'o2', ticker: 'MSFT', side: 'sell', quantity: 10, status: 'pending' },
    ]);

    const result = JSON.parse(await executor.execute('get_open_orders', {}));

    expect(result.count).toBe(2);
    expect(result.orders).toHaveLength(2);
    expect(result.orders[0].order_id).toBe('o1');
    expect(mockEngine.getOpenOrders).toHaveBeenCalledTimes(1);
  });

  it('returns count of 0 when no open orders exist', async () => {
    mockEngine.getOpenOrders.mockResolvedValue([]);
    const result = JSON.parse(await executor.execute('get_open_orders', {}));
    expect(result.count).toBe(0);
    expect(result.orders).toHaveLength(0);
  });
});

describe('create_alert', () => {
  it('writes alert to Supabase', async () => {
    const { createAlert } = await import('../src/recommendations-store.js');
    const result = JSON.parse(
      await executor.execute('create_alert', {
        severity: 'warning',
        title: 'Test',
        message: 'msg',
      }),
    );
    expect(result.id).toBe('alt-1');
    expect(createAlert).toHaveBeenCalled();
  });
});
