'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, FlaskConical, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { DataProvenance, type DataProvenanceProps } from '@/components/ui/data-provenance';
import { useAppStore } from '@/stores/app-store';
import {
  BacktestForm,
  strategyOptions,
  type TrendOption,
} from '@/components/backtest/backtest-form';
import { MetricsTable } from '@/components/backtest/metrics-table';
import { ResultsChart } from '@/components/backtest/results-chart';
import { TradeLog } from '@/components/backtest/trade-log';
import { type BacktestResult } from '@/components/backtest/engine-types';
import { type EngineBacktestResponse, parsePct } from '@/components/backtest/engine-types';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';

export default function BacktestPage() {
  const engineOnline = useAppStore((s) => s.engineOnline);
  const [strategy, setStrategy] = useState(strategyOptions[0]?.id ?? '');
  const [trend, setTrend] = useState<TrendOption>('up');
  const [bars, setBars] = useState(300);
  const [capital, setCapital] = useState(100_000);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setEngineError(null);

    try {
      const seed = Math.floor(Math.random() * 100_000);
      const res = await fetch(engineUrl('/api/v1/backtest/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...engineHeaders() },
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
          sharpe_ratio: parseFloat(s.sharpe_ratio),
          sortino_ratio: parseFloat(s.sortino_ratio),
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
      setLastRunTime(new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Engine unavailable — unknown error';
      setEngineError(message);
    }

    setIsRunning(false);
  }, [strategy, bars, trend, capital]);

  /** Derive the DataProvenance mode from engine health. */
  function deriveProvenanceMode(): DataProvenanceProps['mode'] {
    if (engineOnline === false) return 'offline';
    if (result) return 'live';
    return engineOnline === true ? 'live' : 'offline';
  }

  const s = result?.summary;

  return (
    <div className="space-y-4 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-heading-page text-foreground">Backtest</h1>
            <p className="text-xs text-muted-foreground">Run strategy backtests via the engine</p>
          </div>
        </div>
        <DataProvenance mode={deriveProvenanceMode()} lastUpdated={lastRunTime} />
      </div>

      {/* Engine error — no fallback to synthetic */}
      {engineError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <p className="font-medium">Backtesting requires the engine</p>
            <p className="mt-0.5 text-red-300/70">{engineError}</p>
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="mt-2 inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      )}

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
              <CollapsibleCard
                title="Full Backtest Report"
                summary={strategyOptions.find((o) => o.id === strategy)?.label}
                defaultOpen={true}
                className="bg-card border-border"
              >
                <div className="rounded-md border border-border/50 overflow-hidden">
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
                      ['Profit Factor', s.profit_factor >= 999 ? '∞' : s.profit_factor.toFixed(3)],
                      ['Avg Trade P&L', `$${s.avg_trade_pnl.toFixed(2)}`],
                      ['Avg Holding Period', `${s.avg_holding_bars.toFixed(0)} bars`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between px-4 py-2">
                        <span className="text-xs text-muted-foreground">
                          {label}
                          {label === 'Win Rate' && (
                            <InfoTooltip content="Percentage of trades that were profitable." />
                          )}
                          {label === 'Sharpe Ratio' && (
                            <InfoTooltip content="Risk-adjusted return metric. Values above 1.0 indicate good risk-adjusted performance." />
                          )}
                          {label === 'Sortino Ratio' && (
                            <InfoTooltip content="Like Sharpe but only penalizes downside volatility. Higher is better." />
                          )}
                          {label === 'Max Drawdown' && (
                            <InfoTooltip content="Largest peak-to-trough decline in portfolio value. Lower is better." />
                          )}
                        </span>
                        <span className="text-xs font-mono font-medium text-foreground">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleCard>
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
