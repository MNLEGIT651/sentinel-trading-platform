import type { IngestResult, Strategy } from '@sentinel/shared';

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

  async ingestData(
    tickers: string[],
    timeframe = '1d',
  ): Promise<IngestResult> {
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
}

export function getEngineClient(): EngineClient {
  return new EngineClient(
    process.env.ENGINE_URL || 'http://localhost:8000',
    process.env.ENGINE_API_KEY || 'sentinel-dev-key',
  );
}
