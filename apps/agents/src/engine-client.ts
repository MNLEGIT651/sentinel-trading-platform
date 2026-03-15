/**
 * HTTP client for the Sentinel Engine API.
 * Used by agents to interact with the quant engine.
 */

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
    apiKey: string = process.env.ENGINE_API_KEY ?? 'sentinel-dev-key',
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Engine API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  async getHealth(): Promise<EngineHealth> {
    return this.request<EngineHealth>('/health');
  }

  async getStrategies(): Promise<StrategiesResponse> {
    return this.request<StrategiesResponse>('/api/v1/strategies/');
  }

  async getRiskLimits(): Promise<RiskLimits> {
    return this.request<RiskLimits>('/api/v1/risk/limits');
  }

  async assessRisk(state: {
    equity: number;
    cash: number;
    peak_equity: number;
    daily_starting_equity: number;
    positions: Record<string, number>;
    position_sectors: Record<string, string>;
  }): Promise<RiskAssessmentResponse> {
    return this.request<RiskAssessmentResponse>('/api/v1/risk/assess', {
      method: 'POST',
      body: JSON.stringify(state),
    });
  }

  async calculatePositionSize(params: {
    ticker: string;
    price: number;
    equity: number;
    method?: string;
    risk_fraction?: number;
    atr?: number;
  }): Promise<PositionSizeResponse> {
    return this.request<PositionSizeResponse>('/api/v1/risk/position-size', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async ingestData(tickers: string[], timeframe = '1d') {
    return this.request<{ ingested: number; errors: string[] }>('/api/v1/data/ingest', {
      method: 'POST',
      body: JSON.stringify({ tickers, timeframe }),
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
    return this.request('/api/v1/portfolio/account');
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
    return this.request('/api/v1/portfolio/positions');
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
    return this.request('/api/v1/portfolio/orders', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getOpenOrders(): Promise<unknown[]> {
    return this.request('/api/v1/portfolio/orders?status=open');
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
    return this.request('/api/v1/strategies/scan', { method: 'POST', body: JSON.stringify(body) });
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
    return this.request(`/api/v1/data/quotes?tickers=${tickers.join(',')}`);
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
    return this.request('/api/v1/risk/pre-trade-check', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}
