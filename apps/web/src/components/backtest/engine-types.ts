import type { BacktestSummary } from './results-chart';
import type { TradeEntry } from './trade-log';

/** Unified backtest result shape used by the backtest page. */
export interface BacktestResult {
  summary: BacktestSummary;
  equity_curve: number[];
  trades: TradeEntry[];
}

export interface EngineBacktestSummary {
  strategy: string;
  ticker: string;
  total_return: string;
  annualized_return: string;
  max_drawdown: string;
  sharpe_ratio: string;
  sortino_ratio: string;
  win_rate: string;
  profit_factor: string;
  total_trades: number;
  avg_holding_bars: string;
}

export interface EngineBacktestResponse {
  summary: EngineBacktestSummary;
  equity_curve: number[];
  drawdown_curve: number[];
  trade_count: number;
  trades: TradeEntry[];
}

/** Parse "12.50%" → 0.125  |  "1.234" → 1.234  |  "15.3" → 15.3 */
export function parsePct(s: string): number {
  if (s.endsWith('%')) return parseFloat(s) / 100;
  return parseFloat(s);
}
