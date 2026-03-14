'use client';

import { useState, useCallback } from 'react';
import {
  FlaskConical,
  Play,
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Shield,
  Award,
  Timer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ── Strategy & trend options ─────────────────────────────────────────

const strategyOptions = [
  { id: 'sma_crossover', label: 'SMA Crossover', family: 'Trend Following' },
  { id: 'ema_momentum_trend', label: 'EMA Momentum Trend', family: 'Trend Following' },
  { id: 'macd_trend', label: 'MACD Trend', family: 'Trend Following' },
  { id: 'rsi_momentum', label: 'RSI Momentum', family: 'Momentum' },
  { id: 'roc_momentum', label: 'Rate of Change', family: 'Momentum' },
  { id: 'bollinger_reversion', label: 'Bollinger Reversion', family: 'Mean Reversion' },
  { id: 'zscore_reversion', label: 'Z-Score Reversion', family: 'Mean Reversion' },
  { id: 'price_to_ma_value', label: 'Price-to-MA Value', family: 'Value' },
];

const trendOptions = ['up', 'down', 'volatile', 'random'] as const;

interface BacktestSummary {
  strategy: string;
  ticker: string;
  initial_capital: number;
  final_equity: number;
  total_return: number;
  total_trades: number;
  win_rate: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  profit_factor: number;
  avg_trade_pnl: number;
  avg_holding_bars: number;
}

interface BacktestResult {
  summary: BacktestSummary;
  equity_curve: number[];
  trades: {
    side: string;
    entry_bar: number;
    exit_bar: number;
    entry_price: number;
    exit_price: number;
    pnl: number;
    return_pct: number;
  }[];
}

// ── Synthetic backtest runner (client-side) ──────────────────────────

function runSyntheticBacktest(
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
      trend === 'up' ? 0.0005 : trend === 'down' ? -0.0005 : trend === 'volatile' ? 0 : (rand() - 0.5) * 0.0002;
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
  const trades: BacktestResult['trades'] = [];

  for (let i = 0; i < bars; i++) {
    const price = prices[i];
    const portfolioValue = cash + shares * price;
    equity.push(portfolioValue);

    if (i < 20) continue;

    // Simple moving average crossover logic
    const smaFast = prices.slice(i - 10, i).reduce((a, b) => a + b, 0) / 10;
    const smaSlow = prices.slice(i - 20, i).reduce((a, b) => a + b, 0) / 20;

    if (shares === 0 && smaFast > smaSlow && rand() > 0.3) {
      shares = Math.floor(cash * 0.95 / price);
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
  const avgHolding = trades.length > 0 ? trades.reduce((s, t) => s + (t.exit_bar - t.entry_bar), 0) / trades.length : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  // Returns for Sharpe/Sortino
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((a, b) => a + (b - avgReturn) ** 2, 0) / returns.length);
  const downReturns = returns.filter((r) => r < 0);
  const downDev = Math.sqrt(downReturns.reduce((a, b) => a + b ** 2, 0) / Math.max(downReturns.length, 1));

  // Max drawdown
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

// ── Equity curve mini-chart ──────────────────────────────────────────

function EquityCurveChart({ curve, className }: { curve: number[]; className?: string }) {
  if (curve.length === 0) return null;

  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const range = max - min || 1;
  const h = 200;
  const w = curve.length;

  const points = curve.map((v, i) => `${(i / (w - 1)) * 100},${h - ((v - min) / range) * (h - 20)}`).join(' ');

  const isPositive = curve[curve.length - 1] >= curve[0];

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-full h-40">
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${h} ${points} 100,${h}`}
          fill="url(#equityGrad)"
        />
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? '#22c55e' : '#ef4444'}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function BacktestPage() {
  const [strategy, setStrategy] = useState(strategyOptions[0].id);
  const [trend, setTrend] = useState<(typeof trendOptions)[number]>('up');
  const [bars, setBars] = useState(300);
  const [capital, setCapital] = useState(100_000);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    // Simulate a brief delay for realism
    await new Promise((r) => setTimeout(r, 800));
    const seed = Math.floor(Math.random() * 100_000);
    const res = runSyntheticBacktest(strategy, bars, trend, capital, seed);
    setResult(res);
    setIsRunning(false);
  }, [strategy, bars, trend, capital]);

  const s = result?.summary;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Backtest</h1>
            <p className="text-xs text-muted-foreground">
              Run strategy backtests on synthetic market data
            </p>
          </div>
        </div>
      </div>

      {/* Config panel */}
      <Card className="bg-card border-border">
        <CardContent className="py-4 px-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Strategy select */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Strategy
              </label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {strategyOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.family})
                  </option>
                ))}
              </select>
            </div>

            {/* Trend */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Market Trend
              </label>
              <div className="flex gap-1">
                {trendOptions.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTrend(t)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors border',
                      trend === t
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
                    )}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Bars */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Bars
              </label>
              <input
                type="number"
                value={bars}
                onChange={(e) => setBars(Math.max(50, Math.min(1000, Number(e.target.value))))}
                className="h-9 w-20 rounded-md border border-input bg-background px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Capital */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Capital
              </label>
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(Math.max(1000, Number(e.target.value)))}
                className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Run button */}
            <Button onClick={handleRun} disabled={isRunning} size="lg">
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-1.5">Running...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span className="ml-1.5">Run Backtest</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && s && (
        <div className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[
              {
                label: 'Total Return',
                value: `${(s.total_return * 100).toFixed(2)}%`,
                icon: s.total_return >= 0 ? TrendingUp : TrendingDown,
                color: s.total_return >= 0 ? 'text-profit' : 'text-loss',
              },
              {
                label: 'Sharpe Ratio',
                value: s.sharpe_ratio.toFixed(2),
                icon: BarChart3,
                color: s.sharpe_ratio >= 1 ? 'text-profit' : s.sharpe_ratio >= 0 ? 'text-amber-400' : 'text-loss',
              },
              {
                label: 'Win Rate',
                value: `${(s.win_rate * 100).toFixed(1)}%`,
                icon: Target,
                color: s.win_rate >= 0.5 ? 'text-profit' : 'text-loss',
              },
              {
                label: 'Max Drawdown',
                value: `${(s.max_drawdown * 100).toFixed(2)}%`,
                icon: Shield,
                color: s.max_drawdown > -0.1 ? 'text-profit' : s.max_drawdown > -0.2 ? 'text-amber-400' : 'text-loss',
              },
              {
                label: 'Profit Factor',
                value: s.profit_factor >= 999 ? '∞' : s.profit_factor.toFixed(2),
                icon: Award,
                color: s.profit_factor >= 1.5 ? 'text-profit' : s.profit_factor >= 1 ? 'text-amber-400' : 'text-loss',
              },
              {
                label: 'Avg Holding',
                value: `${s.avg_holding_bars.toFixed(0)} bars`,
                icon: Timer,
                color: 'text-muted-foreground',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="bg-card border-border">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
                    <Icon className={cn('h-3.5 w-3.5', color)} />
                  </div>
                  <p className={cn('text-lg font-bold font-mono', color)}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="curve" className="space-y-3">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="curve">Equity Curve</TabsTrigger>
              <TabsTrigger value="trades">Trades ({result.trades.length})</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            {/* Equity curve */}
            <TabsContent value="curve">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Equity Curve
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        Start: ${s.initial_capital.toLocaleString()}
                      </span>
                      <span className={s.final_equity >= s.initial_capital ? 'text-profit' : 'text-loss'}>
                        End: ${s.final_equity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <EquityCurveChart curve={result.equity_curve} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Trade list */}
            <TabsContent value="trades">
              <Card className="bg-card border-border overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border">
                          {['#', 'Side', 'Entry Bar', 'Exit Bar', 'Entry Price', 'Exit Price', 'P&L', 'Return'].map(
                            (h) => (
                              <th key={h} className="px-4 py-2 text-left">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                  {h}
                                </span>
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {result.trades.map((t, i) => (
                          <tr key={i} className="transition-colors hover:bg-accent/30">
                            <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2">
                              <Badge
                                className={cn(
                                  'border text-[10px]',
                                  t.side === 'long'
                                    ? 'bg-profit/15 text-profit border-profit/30'
                                    : 'bg-loss/15 text-loss border-loss/30',
                                )}
                              >
                                {t.side.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{t.entry_bar}</td>
                            <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{t.exit_bar}</td>
                            <td className="px-4 py-2 text-xs font-mono text-foreground">${t.entry_price.toFixed(2)}</td>
                            <td className="px-4 py-2 text-xs font-mono text-foreground">${t.exit_price.toFixed(2)}</td>
                            <td className="px-4 py-2">
                              <span className={cn('text-xs font-mono', t.pnl >= 0 ? 'text-profit' : 'text-loss')}>
                                {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <span className={cn('text-xs font-mono', t.return_pct >= 0 ? 'text-profit' : 'text-loss')}>
                                {t.return_pct >= 0 ? '+' : ''}{t.return_pct.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Full summary */}
            <TabsContent value="summary">
              <Card className="bg-card border-border">
                <CardContent className="py-4">
                  <div className="rounded-md border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2">
                      <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        Full Backtest Report &mdash; {strategyOptions.find((o) => o.id === strategy)?.label}
                      </p>
                    </div>
                    <div className="divide-y divide-border/50">
                      {[
                        ['Strategy', s.strategy],
                        ['Initial Capital', `$${s.initial_capital.toLocaleString()}`],
                        ['Final Equity', `$${s.final_equity.toLocaleString('en-US', { maximumFractionDigits: 2 })}`],
                        ['Total Return', `${(s.total_return * 100).toFixed(2)}%`],
                        ['Total Trades', String(s.total_trades)],
                        ['Win Rate', `${(s.win_rate * 100).toFixed(1)}%`],
                        ['Sharpe Ratio', s.sharpe_ratio.toFixed(3)],
                        ['Sortino Ratio', s.sortino_ratio.toFixed(3)],
                        ['Max Drawdown', `${(s.max_drawdown * 100).toFixed(2)}%`],
                        ['Profit Factor', s.profit_factor >= 999 ? '∞' : s.profit_factor.toFixed(3)],
                        ['Avg Trade P&L', `$${s.avg_trade_pnl.toFixed(2)}`],
                        ['Avg Holding Period', `${s.avg_holding_bars.toFixed(0)} bars`],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between px-4 py-2">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="text-xs font-mono font-medium text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Empty state */}
      {!result && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FlaskConical className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground text-center">
              Configure a strategy and click &quot;Run Backtest&quot; to see results.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
