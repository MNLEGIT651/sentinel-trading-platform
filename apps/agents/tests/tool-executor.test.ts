import { describe, it, expect } from 'vitest';
import { ToolExecutor } from '../src/tool-executor.js';

describe('ToolExecutor', () => {
  const executor = new ToolExecutor();

  it('should handle get_market_sentiment', async () => {
    const result = await executor.execute('get_market_sentiment', {});
    const parsed = JSON.parse(result);
    expect(parsed.overall).toBeDefined();
    expect(['bullish', 'bearish', 'neutral']).toContain(parsed.overall);
    expect(parsed.sectors).toBeDefined();
  });

  it('should handle create_alert', async () => {
    const result = await executor.execute('create_alert', {
      severity: 'info',
      title: 'Test Alert',
      message: 'This is a test',
    });
    const parsed = JSON.parse(result);
    expect(parsed.id).toBeTruthy();
    expect(parsed.severity).toBe('info');
    expect(parsed.title).toBe('Test Alert');
  });

  it('should handle get_open_orders', async () => {
    const result = await executor.execute('get_open_orders', {});
    const parsed = JSON.parse(result);
    expect(parsed.orders).toEqual([]);
  });

  it('should handle submit_order (paper)', async () => {
    const result = await executor.execute('submit_order', {
      ticker: 'AAPL',
      side: 'buy',
      quantity: 10,
      order_type: 'market',
    });
    const parsed = JSON.parse(result);
    expect(parsed.orderId).toBeTruthy();
    expect(parsed.status).toBe('filled');
    expect(parsed.ticker).toBe('AAPL');
  });

  it('should handle analyze_ticker', async () => {
    const result = await executor.execute('analyze_ticker', {
      ticker: 'AAPL',
      depth: 'standard',
    });
    const parsed = JSON.parse(result);
    expect(parsed.ticker).toBe('AAPL');
    expect(parsed.analysis).toBeDefined();
    expect(parsed.analysis.trend).toBeDefined();
  });

  it('should handle unknown tool gracefully', async () => {
    const result = await executor.execute('nonexistent_tool', {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Unknown tool');
  });
});
