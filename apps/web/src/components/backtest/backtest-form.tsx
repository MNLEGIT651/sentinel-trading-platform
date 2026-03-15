'use client';

import { Play, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const strategyOptions = [
  { id: 'sma_crossover', label: 'SMA Crossover', family: 'Trend Following' },
  { id: 'ema_momentum_trend', label: 'EMA Momentum Trend', family: 'Trend Following' },
  { id: 'macd_trend', label: 'MACD Trend', family: 'Trend Following' },
  { id: 'rsi_momentum', label: 'RSI Momentum', family: 'Momentum' },
  { id: 'roc_momentum', label: 'Rate of Change', family: 'Momentum' },
  { id: 'bollinger_reversion', label: 'Bollinger Reversion', family: 'Mean Reversion' },
  { id: 'zscore_reversion', label: 'Z-Score Reversion', family: 'Mean Reversion' },
  { id: 'price_to_ma_value', label: 'Price-to-MA Value', family: 'Value' },
];

export const trendOptions = ['up', 'down', 'volatile', 'random'] as const;
export type TrendOption = (typeof trendOptions)[number];

interface BacktestFormProps {
  strategy: string;
  onStrategy: (v: string) => void;
  trend: TrendOption;
  onTrend: (v: TrendOption) => void;
  bars: number;
  onBars: (v: number) => void;
  capital: number;
  onCapital: (v: number) => void;
  isRunning: boolean;
  onRun: () => void;
}

export function BacktestForm({
  strategy,
  onStrategy,
  trend,
  onTrend,
  bars,
  onBars,
  capital,
  onCapital,
  isRunning,
  onRun,
}: BacktestFormProps) {
  return (
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
              onChange={(e) => onStrategy(e.target.value)}
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
                  onClick={() => onTrend(t)}
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
              onChange={(e) => onBars(Math.max(50, Math.min(1000, Number(e.target.value))))}
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
              onChange={(e) => onCapital(Math.max(1000, Number(e.target.value)))}
              className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Run button */}
          <Button onClick={onRun} disabled={isRunning} size="lg">
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
  );
}
