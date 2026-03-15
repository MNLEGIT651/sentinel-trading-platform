import type { IngestResult, OHLCV, Strategy } from '@sentinel/shared';

export interface StrategyFamily {
  family: string;
  strategies: Strategy[];
}

export interface RiskLimits {
  max_position_size: number;
  max_portfolio_risk: number;
  max_drawdown_pct: number;
  max_correlation: number;
  max_sector_exposure: number;
  daily_loss_limit: number;
}

export interface MarketQuote {
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number | null;
  timestamp: string;
  change: number;
  change_pct: number;
}

export interface MarketBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number | null;
}

export interface BrokerAccount {
  cash: number;
  positions_value: number;
  equity: number;
  initial_capital: number;
  buying_power?: number;
  status?: string;
  account_id?: string;
}

export interface BrokerPosition {
  instrument_id: string;
  quantity: number;
  avg_price: number;
  market_value?: number;
  current_price?: number;
  unrealized_pl?: number;
  unrealized_plpc?: number;
  side?: string;
}

export interface OrderResult {
  order_id: string;
  status: string;
  fill_price: number | null;
  fill_quantity: number | null;
  commission: number;
  slippage: number | null;
}

export interface OrderRecord {
  order_id: string;
  symbol: string;
  side: string;
  type: string;
  qty: number;
  filled_qty: number;
  status: string;
  submitted_at: string;
  filled_avg_price: number | null;
}

export interface SignalResult {
  ticker: string;
  direction: string; // 'long' | 'short' | 'flat'
  strength: number; // 0.0 to 1.0
  strategy_name: string;
  reason: string;
  metadata: Record<string, unknown>;
}

export interface ScanResult {
  signals: SignalResult[];
  total_signals: number;
  tickers_scanned: number;
  strategies_run: number;
  errors: string[];
}

export class EngineClient {
  readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  url(path: string): string {
    return `${this.baseUrl}/api/v1${path}`;
  }

  async ingestData(tickers: string[], timeframe = '1d'): Promise<IngestResult> {
    const res = await fetch(this.url('/data/ingest'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ tickers, timeframe }),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getHealth(): Promise<{ status: string }> {
    const res = await fetch(this.url('/health'), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getStrategies(): Promise<StrategyFamily[]> {
    const res = await fetch(this.url('/strategies/'), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getRiskLimits(): Promise<RiskLimits> {
    const res = await fetch(this.url('/risk/limits'), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getQuote(ticker: string): Promise<MarketQuote> {
    const res = await fetch(this.url(`/data/quote/${ticker.toUpperCase()}`), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getQuotes(
    tickers: string[] = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY'],
  ): Promise<MarketQuote[]> {
    const param = tickers.map((t) => t.toUpperCase()).join(',');
    const res = await fetch(this.url(`/data/quotes?tickers=${param}`), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getBars(ticker: string, timeframe = '1d', days = 90): Promise<OHLCV[]> {
    const res = await fetch(
      this.url(`/data/bars/${ticker.toUpperCase()}?timeframe=${timeframe}&days=${days}`),
      { headers: this.getHeaders() },
    );
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    const bars: MarketBar[] = await res.json();
    return bars.map((b) => ({
      timestamp: b.timestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));
  }

  async getAccount(): Promise<BrokerAccount> {
    const res = await fetch(this.url('/portfolio/account'), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const res = await fetch(this.url('/portfolio/positions'), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async submitOrder(params: {
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    order_type?: string;
    limit_price?: number;
  }): Promise<OrderResult> {
    const res = await fetch(this.url('/portfolio/orders'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getOrders(status = 'open'): Promise<OrderRecord[]> {
    const res = await fetch(this.url(`/portfolio/orders?status=${status}`), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async cancelOrder(orderId: string): Promise<void> {
    const res = await fetch(this.url(`/portfolio/orders/${orderId}`), {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
  }

  async scanSignals(params: {
    tickers: string[];
    days?: number;
    min_strength?: number;
    use_composite?: boolean;
  }): Promise<ScanResult> {
    const res = await fetch(this.url('/strategies/scan'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ days: 90, min_strength: 0.2, use_composite: false, ...params }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { detail?: string }).detail ?? `Engine error: ${res.status}`);
    }
    return res.json();
  }
}

export function getEngineClient(): EngineClient {
  return new EngineClient(
    process.env.ENGINE_URL || 'http://localhost:8000',
    process.env.ENGINE_API_KEY || 'sentinel-dev-key',
  );
}
