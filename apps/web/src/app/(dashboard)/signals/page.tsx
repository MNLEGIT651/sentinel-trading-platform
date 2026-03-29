'use client';

import { useState, useMemo } from 'react';
import {
  Zap,
  Loader2,
  AlertTriangle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { useAppStore } from '@/stores/app-store';
import type { SignalResult } from '@/lib/engine-client';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import {
  DEFAULT_SIGNAL_TICKERS,
  MAX_LIVE_SCAN_TICKERS,
  SignalFilters,
} from '@/components/signals/signal-filters';
import { SignalTimeline, type SortField, type SortDir } from '@/components/signals/signal-timeline';
import type { SignalRow } from '@/components/signals/signal-card';

export default function SignalsPage() {
  const engineOnline = useAppStore((s) => s.engineOnline);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<{
    tickers: number;
    strategies: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('strength');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showConfig, setShowConfig] = useState(false);
  const [tickerInput, setTickerInput] = useState(DEFAULT_SIGNAL_TICKERS);
  const [minStrength, setMinStrength] = useState(0.2);
  const [days, setDays] = useState(90);

  const handleRunScan = async () => {
    setIsScanning(true);
    setError(null);
    setWarning(null);
    try {
      const requestedTickers = tickerInput
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 20);
      const tickers = requestedTickers.slice(0, MAX_LIVE_SCAN_TICKERS);

      if (requestedTickers.length > MAX_LIVE_SCAN_TICKERS) {
        setWarning(
          `Only the first ${MAX_LIVE_SCAN_TICKERS} tickers were scanned. Large live scans exceed the current Polygon rate limit.`,
        );
      }

      const res = await fetch(engineUrl('/api/v1/strategies/scan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...engineHeaders() },
        body: JSON.stringify({ tickers, days, min_strength: minStrength }),
        signal: AbortSignal.timeout(60_000),
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
      setScanMeta({
        tickers: data.tickers_scanned,
        strategies: data.strategies_run,
        errors: data.errors,
      });
      setLastScanTime(new Date().toLocaleTimeString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed';
      setError(
        message.includes('timed out')
          ? `Signal scan exceeded the live data time budget. Limit scans to ${MAX_LIVE_SCAN_TICKERS} tickers or wait for cached data to refresh.`
          : message,
      );
      setSignals([]);
      setScanMeta(null);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('desc');
    }
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
  const avgStrength =
    signals.length > 0
      ? Math.round((signals.reduce((sum, s) => sum + s.strength, 0) / signals.length) * 100)
      : 0;

  return (
    <div className="space-y-4 p-4">
      {engineOnline === false && <OfflineBanner service="engine" />}

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
          <Button variant="outline" size="sm" onClick={() => setShowConfig((v) => !v)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showConfig ? (
              <ChevronUp className="h-3 w-3 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1" />
            )}
          </Button>
          <Button onClick={handleRunScan} disabled={isScanning || engineOnline !== true} size="sm">
            {isScanning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="ml-1.5">Scanning…</span>
              </>
            ) : (
              <span>Run Scan</span>
            )}
          </Button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <SignalFilters
          tickerInput={tickerInput}
          onTickerInput={setTickerInput}
          days={days}
          onDays={setDays}
          minStrength={minStrength}
          onMinStrength={setMinStrength}
        />
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

      {warning && !error && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="flex items-center gap-2 py-3 px-4">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <span className="text-sm text-amber-300">{warning}</span>
          </CardContent>
        </Card>
      )}

      {/* Scan warnings (partial errors) */}
      {scanMeta && scanMeta.errors.length > 0 && !error && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-2 px-4">
            <p className="text-xs text-amber-400">
              {scanMeta.errors.length} ticker(s) had errors:{' '}
              {scanMeta.errors.slice(0, 3).join('; ')}
              {scanMeta.errors.length > 3 ? ` +${scanMeta.errors.length - 3} more` : ''}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {signals.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Empty state */}
      {!isScanning && !error && signals.length === 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <h2 className="text-sm font-semibold text-foreground mb-1">No signals yet</h2>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">
              Run a signal scan to analyze market conditions across your configured tickers
            </p>
            <Button
              onClick={handleRunScan}
              disabled={isScanning || engineOnline !== true}
              size="sm"
            >
              Run Scan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Signal Table */}
      {!isScanning && !error && signals.length > 0 && (
        <SignalTimeline signals={sortedSignals} onToggleSort={toggleSort} />
      )}
    </div>
  );
}
