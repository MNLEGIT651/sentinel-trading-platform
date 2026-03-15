'use client';

import { Card, CardContent } from '@/components/ui/card';

const DEFAULT_TICKERS = 'AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA,META,SPY,QQQ,JPM';

interface SignalFiltersProps {
  tickerInput: string;
  onTickerInput: (v: string) => void;
  days: number;
  onDays: (v: number) => void;
  minStrength: number;
  onMinStrength: (v: number) => void;
}

export function SignalFilters({
  tickerInput,
  onTickerInput,
  days,
  onDays,
  minStrength,
  onMinStrength,
}: SignalFiltersProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-4 pb-3 px-4 space-y-3">
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
            Tickers (comma-separated, max 20)
          </label>
          <input
            value={tickerInput}
            onChange={(e) => onTickerInput(e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={DEFAULT_TICKERS}
          />
        </div>
        <div className="flex items-center gap-6">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
              Lookback Days
            </label>
            <select
              value={days}
              onChange={(e) => onDays(Number(e.target.value))}
              className="bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none"
            >
              {[60, 90, 120, 180, 252].map((d) => (
                <option key={d} value={d}>
                  {d}d
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
              Min Strength
            </label>
            <select
              value={minStrength}
              onChange={(e) => onMinStrength(Number(e.target.value))}
              className="bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none"
            >
              {[0.0, 0.1, 0.2, 0.3, 0.4, 0.5].map((v) => (
                <option key={v} value={v}>
                  {Math.round(v * 100)}%
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
