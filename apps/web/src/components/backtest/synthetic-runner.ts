import type { BacktestSummary } from './results-chart';
import type { TradeEntry } from './trade-log';

export interface BacktestResult {
  summary: BacktestSummary;
  equity_curve: number[];
  trades: TradeEntry[];
}

export function runSyntheticBacktest(
  strategyName: string,
  bars: number,
  trend: string,
  capital: number,
  seed: number,
): BacktestResult {
  // Deterministic pseudo-random
  let state = seed;
  const rand = () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff;
    return state / 0x7fffffff;
  };

  // Generate price series
  const prices: number[] = [100];
  for (let i = 1; i < bars; i++) {
    const drift =
      trend === 'up'
        ? 0.0005
        : trend === 'down'
          ? -0.0005
          : trend === 'volatile'
            ? 0
            : (rand() - 0.5) * 0.0002;
    const vol = trend === 'volatile' ? 0.025 : 0.015;
    const ret = drift + (rand() - 0.5) * vol;
    prices.push(Math.max(prices[i - 1] * (1 + ret), 5));
  }

  // Simple signal generation
  const equity: number[] = [];
  let cash = capital;
  let shares = 0;
  let entryBar = -1;
  let entryPrice = 0;
  const trades: TradeEntry[] = [];

  for (let i = 0; i < bars; i++) {
    const price = prices[i];
    const portfolioValue = cash + shares * price;
    equity.push(portfolioValue);

    if (i < 20) continue;

    const smaFast = prices.slice(i - 10, i).reduce((a, b) => a + b, 0) / 10;
    const smaSlow = prices.slice(i - 20, i).reduce((a, b) => a + b, 0) / 20;

    if (shares === 0 && smaFast > smaSlow && rand() > 0.3) {
      shares = Math.floor((cash * 0.95) / price);
      if (shares > 0) {
        cash -= shares * price;
        entryBar = i;
        entryPrice = price;
      }
    } else if (shares > 0 && (smaFast < smaSlow || i - entryBar > 30)) {
      cash += shares * price;
      const tradePnl = (price - entryPrice) * shares;
      trades.push({
        side: 'long',
        entry_bar: entryBar,
        exit_bar: i,
        entry_price: entryPrice,
        exit_price: price,
        pnl: tradePnl,
        return_pct: ((price - entryPrice) / entryPrice) * 100,
      });
      shares = 0;
    }
  }

  // Close final position
  if (shares > 0) {
    const lastPrice = prices[bars - 1];
    cash += shares * lastPrice;
    trades.push({
      side: 'long',
      entry_bar: entryBar,
      exit_bar: bars - 1,
      entry_price: entryPrice,
      exit_price: lastPrice,
      pnl: (lastPrice - entryPrice) * shares,
      return_pct: ((lastPrice - entryPrice) / entryPrice) * 100,
    });
    shares = 0;
  }

  const finalEquity = equity[equity.length - 1] ?? capital;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const avgPnl = trades.length > 0 ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length : 0;
  const avgHolding =
    trades.length > 0
      ? trades.reduce((s, t) => s + (t.exit_bar - t.entry_bar), 0) / trades.length
      : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((a, b) => a + (b - avgReturn) ** 2, 0) / returns.length,
  );
  const downReturns = returns.filter((r) => r < 0);
  const downDev = Math.sqrt(
    downReturns.reduce((a, b) => a + b ** 2, 0) / Math.max(downReturns.length, 1),
  );

  let peak = equity[0];
  let maxDd = 0;
  for (const e of equity) {
    if (e > peak) peak = e;
    const dd = (e - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }

  return {
    summary: {
      strategy: strategyName,
      ticker: 'SYNTHETIC',
      initial_capital: capital,
      final_equity: finalEquity,
      total_return: (finalEquity - capital) / capital,
      total_trades: trades.length,
      win_rate: winRate,
      sharpe_ratio: stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0,
      sortino_ratio: downDev > 0 ? (avgReturn / downDev) * Math.sqrt(252) : 0,
      max_drawdown: maxDd,
      profit_factor: profitFactor,
      avg_trade_pnl: avgPnl,
      avg_holding_bars: avgHolding,
    },
    equity_curve: equity,
    trades,
  };
}
