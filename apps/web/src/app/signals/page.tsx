'use client';

import { useState, useMemo } from 'react';
import {
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Radar,
  AlertTriangle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SignalResult } from '@/lib/engine-client';

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:8000';

const DEFAULT_TICKERS = 'AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA,META,SPY,QQQ,JPM';

interface SignalRow extends SignalResult {
  id: string;
}

type SortField = 'strength' | 'ticker' | 'direction';
type SortDir = 'asc' | 'desc';

function StrengthBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-profit' : pct >= 50 ? 'bg-amber-500' : 'bg-muted-foreground';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-7 text-right">{pct}</span>
    </div>
  );
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<{ tickers: number; strategies: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('strength');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showConfig, setShowConfig] = useState(false);
  const [tickerInput, setTickerInput] = useState(DEFAULT_TICKERS);
  const [minStrength, setMinStrength] = useState(0.2);
  const [days, setDays] = useState(90);

  const handleRunScan = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const tickers = tickerInput
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 20);

      const res = await fetch(`${ENGINE_URL}/api/v1/strategies/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers, days, min_strength: minStrength }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? `Engine error: ${res.status}`);
      }

      const data = await res.json();
      const rows: SignalRow[] = (data.signals as SignalResult[]).map((s, i) => ({
        ...s,
        id: `sig-${Date.now()}-${i}`,
      }));
      setSignals(rows);
      setScanMeta({ tickers: data.tickers_scanned, strategies: data.strategies_run, errors: data.errors });
      setLastScanTime(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setSignals([]);
      setScanMeta(null);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortedSignals = useMemo(() => {
    return [...signals].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'strength') return (a.strength - b.strength) * mul;
      if (sortField === 'ticker') return a.ticker.localeCompare(b.ticker) * mul;
      if (sortField === 'direction') return a.direction.localeCompare(b.direction) * mul;
      return 0;
    });
  }, [signals, sortField, sortDir]);

  const longCount = signals.filter((s) => s.direction === 'long').length;
  const shortCount = signals.filter((s) => s.direction === 'short').length;
  const avgStrength = signals.length > 0
    ? Math.round((signals.reduce((sum, s) => sum + s.strength, 0) / signals.length) * 100)
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
                ? `${signals.length} signal${signals.length !== 1 ? 's' : ''} from ${scanMeta?.tickers ?? 0} tickers · ${lastScanTime}`
                : 'Run a scan to analyze the market'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig((v) => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showConfig ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
          <Button onClick={handleRunScan} disabled={isScanning} size="sm">
            {isScanning ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="ml-1.5">Scanning…</span></>
            ) : (
              <span>Run Scan</span>
            )}
          </Button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4 space-y-3">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                Tickers (comma-separated, max 20)
              </label>
              <input
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="AAPL, MSFT, GOOGL…"
              />
            </div>
            <div className="flex items-center gap-6">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                  Lookback Days
                </label>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none"
                >
                  {[60, 90, 120, 180, 252].map((d) => (
                    <option key={d} value={d}>{d}d</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                  Min Strength
                </label>
                <select
                  value={minStrength}
                  onChange={(e) => setMinStrength(Number(e.target.value))}
                  className="bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none"
                >
                  {[0.0, 0.1, 0.2, 0.3, 0.4, 0.5].map((v) => (
                    <option key={v} value={v}>{Math.round(v * 100)}%</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="bg-loss/10 border-loss/30">
          <CardContent className="flex items-center gap-2 py-3 px-4">
            <AlertTriangle className="h-4 w-4 text-loss flex-shrink-0" />
            <span className="text-sm text-loss">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Scan warnings (partial errors) */}
      {scanMeta && scanMeta.errors.length > 0 && !error && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-2 px-4">
            <p className="text-xs text-amber-400">
              {scanMeta.errors.length} ticker(s) had errors: {scanMeta.errors.slice(0, 3).join('; ')}
              {scanMeta.errors.length > 3 ? ` +${scanMeta.errors.length - 3} more` : ''}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {signals.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <span className="text-xs text-muted-foreground">Signals</span>
              <span className="text-lg font-bold text-foreground">{signals.length}</span>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <span className="text-xs text-muted-foreground">Long / Short</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-profit">{longCount}L</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-sm font-semibold text-loss">{shortCount}S</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <span className="text-xs text-muted-foreground">Avg Strength</span>
              <span className="text-lg font-bold text-foreground">{avgStrength}</span>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <span className="text-xs text-muted-foreground">Strategies</span>
              <span className="text-lg font-bold text-foreground">{scanMeta?.strategies ?? 0}</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty / Table */}
      {signals.length === 0 && !isScanning && !error ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Radar className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground text-center">
              No signals yet. Configure tickers above and run a scan.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 text-center max-w-xs">
              Free-tier Polygon processes ~1 ticker per 12s — scans over 5 tickers may take a minute.
            </p>
          </CardContent>
        </Card>
      ) : signals.length > 0 ? (
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
                    {(['ticker', 'direction', 'strength'] as const).map((field) => (
                      <th key={field} className="px-4 py-2 text-left">
                        <button
                          onClick={() => toggleSort(field)}
                          className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {field}
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-2 text-left">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Strategy</span>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Reason</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sortedSignals.map((signal) => (
                    <tr key={signal.id} className="transition-colors hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-foreground">{signal.ticker}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border text-[10px] font-semibold',
                            signal.direction === 'long'
                              ? 'bg-profit/15 text-profit border-profit/30'
                              : 'bg-loss/15 text-loss border-loss/30',
                          )}
                        >
                          {signal.direction === 'long'
                            ? <ArrowUp className="mr-0.5 h-3 w-3" />
                            : <ArrowDown className="mr-0.5 h-3 w-3" />}
                          {signal.direction.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StrengthBar value={signal.strength} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{signal.strategy_name}</span>
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
      ) : null}
    </div>
  );
}
