'use client';

import { useState, useCallback } from 'react';
import { FlaskConical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BacktestForm,
  strategyOptions,
  type TrendOption,
} from '@/components/backtest/backtest-form';
import { MetricsTable } from '@/components/backtest/metrics-table';
import { ResultsChart } from '@/components/backtest/results-chart';
import { TradeLog, type TradeEntry } from '@/components/backtest/trade-log';
import { runSyntheticBacktest, type BacktestResult } from '@/components/backtest/synthetic-runner';

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:8000';

// ── Engine API types ─────────────────────────────────────────────────

interface EngineBacktestSummary {
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

interface EngineBacktestResponse {
  summary: EngineBacktestSummary;
  equity_curve: number[];
  drawdown_curve: number[];
  trade_count: number;
  trades: TradeEntry[];
}

/** Parse "12.50%" → 0.125  |  "1.234" → 1.234  |  "15.3" → 15.3 */
function parsePct(s: string): number {
  if (s.endsWith('%')) return parseFloat(s) / 100;
  return parseFloat(s);
}

export default function BacktestPage() {
  const [strategy, setStrategy] = useState(strategyOptions[0].id);
  const [trend, setTrend] = useState<TrendOption>('up');
  const [bars, setBars] = useState(300);
  const [capital, setCapital] = useState(100_000);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const handleRun = useCallback(async () => {
    setIsRunning(true);

    let ran = false;
    try {
      const seed = Math.floor(Math.random() * 100_000);
      const res = await fetch(`${ENGINE_URL}/api/v1/backtest/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_name: strategy,
          bars,
          initial_capital: capital,
          trend,
          seed,
          ticker: 'SYNTHETIC',
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(err.detail ?? `Engine error ${res.status}`);
      }

      const data: EngineBacktestResponse = await res.json();
      const s = data.summary;

      setResult({
        summary: {
          strategy: s.strategy,
          ticker: s.ticker,
          initial_capital: capital,
          final_equity: capital * (1 + parsePct(s.total_return)),
          total_return: parsePct(s.total_return),
          total_trades: s.total_trades,
          win_rate: parsePct(s.win_rate),
          sharpe_ratio: parsePct(s.sharpe_ratio),
          sortino_ratio: parsePct(s.sortino_ratio),
          max_drawdown: parsePct(s.max_drawdown),
          profit_factor: parsePct(s.profit_factor),
          avg_trade_pnl:
            data.trades.length > 0
              ? data.trades.reduce((sum, t) => sum + t.pnl, 0) / data.trades.length
              : 0,
          avg_holding_bars: parseFloat(s.avg_holding_bars),
        },
        equity_curve: data.equity_curve,
        trades: data.trades,
      });
      ran = true;
    } catch {
      // Engine offline or strategy unknown — fall back to client-side simulation
    }

    if (!ran) {
      await new Promise((r) => setTimeout(r, 800));
      const seed = Math.floor(Math.random() * 100_000);
      setResult(runSyntheticBacktest(strategy, bars, trend, capital, seed));
    }

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

      <BacktestForm
        strategy={strategy}
        onStrategy={setStrategy}
        trend={trend}
        onTrend={setTrend}
        bars={bars}
        onBars={setBars}
        capital={capital}
        onCapital={setCapital}
        isRunning={isRunning}
        onRun={handleRun}
      />

      {/* Results */}
      {result && s && (
        <div className="space-y-4">
          <MetricsTable summary={s} />

          <Tabs defaultValue="curve" className="space-y-3">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="curve">Equity Curve</TabsTrigger>
              <TabsTrigger value="trades">Trades ({result.trades.length})</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="curve">
              <ResultsChart summary={s} equityCurve={result.equity_curve} />
            </TabsContent>

            <TabsContent value="trades">
              <TradeLog trades={result.trades} />
            </TabsContent>

            <TabsContent value="summary">
              <Card className="bg-card border-border">
                <CardContent className="py-4">
                  <div className="rounded-md border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2">
                      <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        Full Backtest Report &mdash;{' '}
                        {strategyOptions.find((o) => o.id === strategy)?.label}
                      </p>
                    </div>
                    <div className="divide-y divide-border/50">
                      {[
                        ['Strategy', s.strategy],
                        ['Initial Capital', `$${s.initial_capital.toLocaleString()}`],
                        [
                          'Final Equity',
                          `$${s.final_equity.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
                        ],
                        ['Total Return', `${(s.total_return * 100).toFixed(2)}%`],
                        ['Total Trades', String(s.total_trades)],
                        ['Win Rate', `${(s.win_rate * 100).toFixed(1)}%`],
                        ['Sharpe Ratio', s.sharpe_ratio.toFixed(3)],
                        ['Sortino Ratio', s.sortino_ratio.toFixed(3)],
                        ['Max Drawdown', `${(s.max_drawdown * 100).toFixed(2)}%`],
                        [
                          'Profit Factor',
                          s.profit_factor >= 999 ? '∞' : s.profit_factor.toFixed(3),
                        ],
                        ['Avg Trade P&L', `$${s.avg_trade_pnl.toFixed(2)}`],
                        ['Avg Holding Period', `${s.avg_holding_bars.toFixed(0)} bars`],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between px-4 py-2">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="text-xs font-mono font-medium text-foreground">
                            {value}
                          </span>
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
