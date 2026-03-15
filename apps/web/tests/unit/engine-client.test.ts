import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EngineClient } from '@/lib/engine-client';
import type { StrategyFamily, RiskLimits } from '@/lib/engine-client';

describe('EngineClient', () => {
  const client = new EngineClient('http://localhost:8000', 'test-key');

  it('constructs correct base URL', () => {
    expect(client.baseUrl).toBe('http://localhost:8000');
  });

  it('builds correct headers', () => {
    const h = client.getHeaders();
    expect(h['Authorization']).toBe('Bearer test-key');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('builds correct endpoint URLs', () => {
    expect(client.url('/data/ingest')).toBe('http://localhost:8000/api/v1/data/ingest');
    expect(client.url('/health')).toBe('http://localhost:8000/api/v1/health');
  });

  it('builds correct strategies endpoint URL', () => {
    expect(client.url('/strategies/')).toBe('http://localhost:8000/api/v1/strategies/');
  });

  it('builds correct risk limits endpoint URL', () => {
    expect(client.url('/risk/limits')).toBe('http://localhost:8000/api/v1/risk/limits');
  });
});

describe('EngineClient.getStrategies', () => {
  const client = new EngineClient('http://localhost:8000', 'test-key');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the correct endpoint and returns strategy families', async () => {
    const mockResponse: StrategyFamily[] = [
      {
        family: 'trend_following',
        strategies: [
          {
            id: 'tf-1',
            name: 'SMA Crossover',
            description: 'Simple moving average crossover strategy',
            version: '1.0.0',
            is_active: true,
            parameters: { fast_period: 20, slow_period: 50 },
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const result = await client.getStrategies();

    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/strategies/', {
      headers: client.getHeaders(),
    });
    expect(result).toEqual(mockResponse);
    expect(result[0].family).toBe('trend_following');
    expect(result[0].strategies).toHaveLength(1);
    expect(result[0].strategies[0].name).toBe('SMA Crossover');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    await expect(client.getStrategies()).rejects.toThrow('Engine error: 500');
  });
});

describe('EngineClient.getRiskLimits', () => {
  const client = new EngineClient('http://localhost:8000', 'test-key');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the correct endpoint and returns risk limits', async () => {
    const mockResponse: RiskLimits = {
      max_position_size: 10000,
      max_portfolio_risk: 0.02,
      max_drawdown_pct: 0.1,
      max_correlation: 0.7,
      max_sector_exposure: 0.3,
      daily_loss_limit: 5000,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const result = await client.getRiskLimits();

    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/risk/limits', {
      headers: client.getHeaders(),
    });
    expect(result).toEqual(mockResponse);
    expect(result.max_position_size).toBe(10000);
    expect(result.max_drawdown_pct).toBe(0.1);
    expect(result.daily_loss_limit).toBe(5000);
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }),
    );

    await expect(client.getRiskLimits()).rejects.toThrow('Engine error: 403');
  });
});
