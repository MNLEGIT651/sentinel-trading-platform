/**
 * HTTP client for the Sentinel Engine API.
 * Used by agents to interact with the quant engine.
 */

import { logger } from './logger.js';
import { getCorrelationId, CORRELATION_HEADER } from './correlation.js';

const DEFAULT_READ_TIMEOUT_MS = 10_000;
const DEFAULT_MUTATION_TIMEOUT_MS = 15_000;

export interface EngineHealth {
  status: string;
  engine: string;
  version: string;
}

export interface StrategyInfo {
  name: string;
  family: string;
  description: string;
  default_params: Record<string, unknown>;
}

export interface StrategiesResponse {
  strategies: StrategyInfo[];
  families: string[];
  total: number;
}

export interface RiskLimits {
  max_position_pct: number;
  max_sector_pct: number;
  max_portfolio_risk_pct: number;
  max_drawdown_soft: number;
  max_drawdown_hard: number;
  max_open_positions: number;
}

export interface RiskAssessmentResponse {
  equity: number;
  cash: number;
  drawdown: number;
  daily_pnl: number;
  position_count: number;
  concentrations: Record<string, number>;
  sector_concentrations: Record<string, number>;
  alerts: Array<{ severity: string; rule: string; message: string; action: string }>;
  halted: boolean;
}

export interface PositionSizeResponse {
  ticker: string;
  shares: number;
  dollar_amount: number;
  weight: number;
  method: string;
  risk_per_share: number;
}

export class EngineClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(
    baseUrl: string = process.env.ENGINE_URL ?? 'http://localhost:8000',
    apiKey: string = process.env.ENGINE_API_KEY ?? '',
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private headers(extra?: HeadersInit): Record<string, string> {
    const correlationId = getCorrelationId();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...(correlationId ? { [CORRELATION_HEADER]: correlationId } : {}),
      ...(extra as Record<string, string>),
    };
  }

  /** Plain fetch with timeout — used for non-idempotent (POST) requests. */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`Engine error: ${res.status}`);
      return res;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Engine error:')) throw err;
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new Error(`Engine timed out after ${timeoutMs}ms: ${init.method ?? 'GET'} ${url}`);
      }
      throw new Error(`Engine unreachable: ${(err as Error).message}`);
    }
  }

  /** Fetch with timeout + retry on transient failures — used for idempotent GET requests. */
  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    retries = 1,
  ): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
        if (res.ok) return res;
        if (attempt < retries && [502, 503, 504].includes(res.status)) {
          logger.warn('engine.retry', { url, status: res.status, attempt: attempt + 1 });
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
        throw new Error(`Engine error: ${res.status}`);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Engine error:')) throw err;
        if (attempt < retries) {
          logger.warn('engine.retry', {
            url,
            error: (err as Error).message,
            attempt: attempt + 1,
          });
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
        if (err instanceof DOMException && err.name === 'TimeoutError') {
          throw new Error(`Engine timed out after ${timeoutMs}ms: ${init.method ?? 'GET'} ${url}`);
        }
        throw new Error(`Engine unreachable: ${(err as Error).message}`);
      }
    }
    throw new Error('Engine request failed after all retries');
  }

  /** GET request with retry and read timeout. */
  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchWithRetry(
      url,
      { method: 'GET', headers: this.headers() },
      DEFAULT_READ_TIMEOUT_MS,
    );
    return res.json() as Promise<T>;
  }

  /** POST request with mutation timeout (no retry). */
  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchWithTimeout(
      url,
      { method: 'POST', headers: this.headers(), body: JSON.stringify(body) },
      DEFAULT_MUTATION_TIMEOUT_MS,
    );
    return res.json() as Promise<T>;
  }

  async getHealth(): Promise<EngineHealth> {
    return this.get<EngineHealth>('/health');
  }

  async getStrategies(): Promise<StrategiesResponse> {
    return this.get<StrategiesResponse>('/api/v1/strategies/');
  }

  async getRiskLimits(): Promise<RiskLimits> {
    return this.get<RiskLimits>('/api/v1/risk/limits');
  }

  async assessRisk(state: {
    equity: number;
    cash: number;
    peak_equity: number;
    daily_starting_equity: number;
    positions: Record<string, number>;
    position_sectors: Record<string, string>;
  }): Promise<RiskAssessmentResponse> {
    return this.post<RiskAssessmentResponse>('/api/v1/risk/assess', state);
  }

  async calculatePositionSize(params: {
    ticker: string;
    price: number;
    equity: number;
    method?: string;
    risk_fraction?: number;
    atr?: number;
  }): Promise<PositionSizeResponse> {
    return this.post<PositionSizeResponse>('/api/v1/risk/position-size', params);
  }

  async ingestData(tickers: string[], timeframe = '1d') {
    return this.post<{ ingested: number; errors: string[] }>('/api/v1/data/ingest', {
      tickers,
      timeframe,
    });
  }

  // ── Portfolio ──────────────────────────────────────────────────

  async getAccount(): Promise<{
    cash: number;
    equity: number;
    positions_value: number;
    initial_capital: number;
    buying_power?: number;
    status?: string;
    account_id?: string;
  }> {
    return this.get('/api/v1/portfolio/account');
  }

  async getPositions(): Promise<
    Array<{
      instrument_id: string;
      quantity: number;
      avg_price: number;
      market_value: number;
      side: string;
      current_price?: number;
    }>
  > {
    return this.get('/api/v1/portfolio/positions');
  }

  async submitOrder(params: {
    symbol: string;
    side: 'buy' | 'sell';
    order_type: 'market' | 'limit';
    quantity: number;
    limit_price?: number;
    time_in_force?: string;
  }): Promise<{
    order_id: string;
    status: string;
    fill_price?: number;
    fill_quantity?: number;
    risk_note?: string;
  }> {
    return this.post('/api/v1/portfolio/orders', params);
  }

  async getOpenOrders(): Promise<unknown[]> {
    return this.get('/api/v1/portfolio/orders?status=open');
  }

  // ── Strategies ─────────────────────────────────────────────────

  async scanStrategies(
    params:
      | {
          tickers: string[];
          days?: number;
          min_strength?: number;
          use_composite?: boolean;
        }
      | string[],
  ): Promise<{
    signals: Array<{
      ticker: string;
      direction: string;
      strength: number;
      strategy_name: string;
      reason: string;
    }>;
    total_signals: number;
    tickers_scanned: number;
    strategies_run: number;
    errors: string[];
  }> {
    const body = Array.isArray(params)
      ? { tickers: params, days: 90, min_strength: 0.3 }
      : { days: 90, min_strength: 0.3, ...params };
    return this.post('/api/v1/strategies/scan', body);
  }

  // ── Data ───────────────────────────────────────────────────────

  async getQuotes(tickers: string[]): Promise<
    Array<{
      ticker: string;
      close: number;
      change_pct: number;
      open: number;
      high: number;
      low: number;
      volume: number;
      timestamp: string;
    }>
  > {
    return this.get(`/api/v1/data/quotes?tickers=${tickers.join(',')}`);
  }

  // ── Risk ───────────────────────────────────────────────────────

  async preTradeCheck(params: {
    ticker: string;
    shares: number;
    price: number;
    side: 'buy' | 'sell';
    equity: number;
    cash: number;
    peak_equity: number;
    daily_starting_equity: number;
    positions: Record<string, number>;
    position_sectors: Record<string, string>;
  }): Promise<{
    allowed: boolean;
    action: string;
    reason: string;
    adjusted_shares: number | null;
  }> {
    return this.post('/api/v1/risk/pre-trade-check', params);
  }
}
