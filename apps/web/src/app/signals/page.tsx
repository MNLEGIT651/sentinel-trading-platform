'use client';

import { useState, useMemo } from 'react';
import {
  Zap,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Radar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SignalRow {
  id: string;
  ticker: string;
  direction: 'LONG' | 'SHORT';
  strength: number; // 0-100
  strategy: string;
  reason: string;
  generatedAt: string;
}

// Mock signal generation
function generateMockSignals(): SignalRow[] {
  const strategies = [
    'SMA Crossover',
    'RSI Momentum',
    'MACD Divergence',
    'Bollinger Band Reversion',
    'Cointegration Pairs',
    'EMA Trend Rider',
  ];

  const tickers = [
    'AAPL',
    'MSFT',
    'GOOGL',
    'AMZN',
    'NVDA',
    'TSLA',
    'META',
    'JPM',
    'V',
    'AMD',
    'NFLX',
    'CRM',
  ];

  const reasons: Record<string, string[]> = {
    'SMA Crossover': [
      'Fast SMA (20) crossed above slow SMA (50) with rising volume',
      'Fast SMA (20) crossed below slow SMA (50) with declining breadth',
      'Golden cross confirmed with 3-day hold above SMA',
    ],
    'RSI Momentum': [
      'RSI dropped below 30 showing oversold condition on daily chart',
      'RSI exceeded 70 indicating overbought momentum divergence',
      'RSI bullish divergence: price making lower lows, RSI making higher lows',
    ],
    'MACD Divergence': [
      'MACD histogram showing bullish divergence over 5 sessions',
      'MACD bearish crossover below signal line with expanding histogram',
      'MACD centerline crossover with increasing volume confirmation',
    ],
    'Bollinger Band Reversion': [
      'Price touched lower Bollinger Band with mean reversion setup',
      'Price exceeded upper Bollinger Band by 1.5 std devs',
      'Bollinger Band squeeze breakout with expanding bandwidth',
    ],
    'Cointegration Pairs': [
      'Spread z-score exceeded 2.0, pair reversion signal triggered',
      'Cointegrated pair spread widened beyond 2 standard deviations',
    ],
    'EMA Trend Rider': [
      'Price sustained above 21 EMA with positive slope for 5 sessions',
      'EMA slope turned negative with price breaking below support',
    ],
  };

  const numSignals = 5 + Math.floor(Math.random() * 6);
  const selectedTickers = tickers
    .sort(() => Math.random() - 0.5)
    .slice(0, numSignals);

  return selectedTickers.map((ticker, i) => {
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    const strategyReasons = reasons[strategy];
    const reason =
      strategyReasons[Math.floor(Math.random() * strategyReasons.length)];

    return {
      id: `sig-${Date.now()}-${i}`,
      ticker,
      direction: Math.random() > 0.4 ? 'LONG' : 'SHORT',
      strength: Math.floor(40 + Math.random() * 60),
      strategy,
      reason,
      generatedAt: new Date().toISOString(),
    };
  });
}

type SortField = 'strength' | 'ticker' | 'direction';
type SortDir = 'asc' | 'desc';

function StrengthBar({ value }: { value: number }) {
  const getColor = (v: number) => {
    if (v >= 80) return 'bg-profit';
    if (v >= 60) return 'bg-amber-500';
    return 'bg-muted-foreground';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', getColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-7 text-right">
        {value}
      </span>
    </div>
  );
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [sortField, setSortField] = useState<SortField>('strength');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  const handleRunScan = async () => {
    setIsScanning(true);
    // Simulate scan delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const newSignals = generateMockSignals();
    setSignals(newSignals);
    setLastScanTime(new Date().toLocaleTimeString());
    setIsScanning(false);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedSignals = useMemo(() => {
    return [...signals].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'strength') return (a.strength - b.strength) * mul;
      if (sortField === 'ticker')
        return a.ticker.localeCompare(b.ticker) * mul;
      if (sortField === 'direction')
        return a.direction.localeCompare(b.direction) * mul;
      return 0;
    });
  }, [signals, sortField, sortDir]);

  const longCount = signals.filter((s) => s.direction === 'LONG').length;
  const shortCount = signals.filter((s) => s.direction === 'SHORT').length;
  const avgStrength =
    signals.length > 0
      ? Math.round(
          signals.reduce((sum, s) => sum + s.strength, 0) / signals.length,
        )
      : 0;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Signals</h1>
            <p className="text-xs text-muted-foreground">
              {signals.length > 0
                ? `${signals.length} signals generated${lastScanTime ? ` at ${lastScanTime}` : ''}`
                : 'Run a scan to analyze the market'}
            </p>
          </div>
        </div>
        <Button
          onClick={handleRunScan}
          disabled={isScanning}
          variant="default"
          size="lg"
        >
          {isScanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-1.5">Scanning...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              <span className="ml-1.5">Run Scan</span>
            </>
          )}
        </Button>
      </div>

      {/* Summary Cards */}
      {signals.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <span className="text-xs text-muted-foreground">
                Total Signals
              </span>
              <span className="text-lg font-bold text-foreground">
                {signals.length}
              </span>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <span className="text-xs text-muted-foreground">
                Long / Short
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-profit">
                  {longCount}L
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="text-sm font-semibold text-loss">
                  {shortCount}S
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <span className="text-xs text-muted-foreground">
                Avg Strength
              </span>
              <span className="text-lg font-bold text-foreground">
                {avgStrength}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Signals Table */}
      {signals.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Radar className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground text-center">
              No signals generated yet. Run a scan to analyze the market.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-0 pt-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Signal Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => toggleSort('ticker')}
                        className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Ticker
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => toggleSort('direction')}
                        className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Direction
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => toggleSort('strength')}
                        className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Strength
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Strategy
                      </span>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Reason
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sortedSignals.map((signal) => (
                    <tr
                      key={signal.id}
                      className="transition-colors hover:bg-accent/30"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-foreground">
                          {signal.ticker}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border text-[10px] font-semibold',
                            signal.direction === 'LONG'
                              ? 'bg-profit/15 text-profit border-profit/30'
                              : 'bg-loss/15 text-loss border-loss/30',
                          )}
                        >
                          {signal.direction === 'LONG' ? (
                            <ArrowUp className="mr-0.5 h-3 w-3" />
                          ) : (
                            <ArrowDown className="mr-0.5 h-3 w-3" />
                          )}
                          {signal.direction}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StrengthBar value={signal.strength} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {signal.strategy}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground leading-relaxed line-clamp-2 max-w-xs">
                          {signal.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
