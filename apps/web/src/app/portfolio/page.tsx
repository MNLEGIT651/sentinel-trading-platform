'use client';

import { useState, useMemo } from 'react';
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  DollarSign,
  Percent,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ── Mock portfolio data ──────────────────────────────────────────────

interface Position {
  ticker: string;
  name: string;
  shares: number;
  avgEntry: number;
  currentPrice: number;
  sector: string;
}

const positions: Position[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', shares: 50, avgEntry: 165.40, currentPrice: 178.72, sector: 'Technology' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', shares: 20, avgEntry: 350.20, currentPrice: 378.91, sector: 'Technology' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', shares: 15, avgEntry: 420.00, currentPrice: 495.22, sector: 'Technology' },
  { ticker: 'JPM', name: 'JPMorgan Chase', shares: 40, avgEntry: 160.50, currentPrice: 172.96, sector: 'Financials' },
  { ticker: 'V', name: 'Visa Inc.', shares: 25, avgEntry: 245.80, currentPrice: 261.53, sector: 'Financials' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', shares: 40, avgEntry: 160.00, currentPrice: 178.25, sector: 'Consumer' },
  { ticker: 'META', name: 'Meta Platforms', shares: 15, avgEntry: 320.00, currentPrice: 355.64, sector: 'Technology' },
  { ticker: 'SPY', name: 'SPDR S&P 500', shares: 80, avgEntry: 440.00, currentPrice: 456.38, sector: 'Index' },
];

const sectorColors: Record<string, string> = {
  Technology: 'bg-blue-500',
  Financials: 'bg-amber-500',
  Consumer: 'bg-emerald-500',
  Index: 'bg-violet-500',
  Healthcare: 'bg-rose-500',
  Energy: 'bg-orange-500',
};

const sectorBadges: Record<string, string> = {
  Technology: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Financials: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Consumer: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Index: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  Healthcare: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  Energy: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

type SortField = 'ticker' | 'marketValue' | 'pnl' | 'pnlPct';
type SortDir = 'asc' | 'desc';

function pnl(p: Position) {
  return (p.currentPrice - p.avgEntry) * p.shares;
}

function pnlPct(p: Position) {
  return ((p.currentPrice - p.avgEntry) / p.avgEntry) * 100;
}

function marketValue(p: Position) {
  return p.currentPrice * p.shares;
}

// ── Simple SVG donut chart ───────────────────────────────────────────

function AllocationDonut({ allocations }: { allocations: { label: string; pct: number; color: string }[] }) {
  const radius = 60;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
        {allocations.map((a) => {
          const dashLen = (a.pct / 100) * circumference;
          const dashOffset = -offset;
          offset += dashLen;
          return (
            <circle
              key={a.label}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              className={a.color.replace('bg-', 'text-')}
              transform="rotate(-90 80 80)"
            />
          );
        })}
        <text x="80" y="76" textAnchor="middle" className="fill-foreground text-lg font-bold" fontSize="18">
          {allocations.length}
        </text>
        <text x="80" y="94" textAnchor="middle" className="fill-muted-foreground" fontSize="11">
          sectors
        </text>
      </svg>
      <div className="space-y-2">
        {allocations.map((a) => (
          <div key={a.label} className="flex items-center gap-2">
            <div className={cn('h-2.5 w-2.5 rounded-full', a.color)} />
            <span className="text-xs text-muted-foreground w-24">{a.label}</span>
            <span className="text-xs font-mono font-medium text-foreground">{a.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Risk gauge ──────────────────────────────────────────────────────

function RiskGauge({ level, label }: { level: number; label: string }) {
  const pct = Math.min(Math.max(level, 0), 100);
  const color = pct < 30 ? 'bg-profit' : pct < 60 ? 'bg-amber-500' : 'bg-loss';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono text-foreground">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [sortField, setSortField] = useState<SortField>('marketValue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const totalValue = positions.reduce((s, p) => s + marketValue(p), 0);
  const totalPnl = positions.reduce((s, p) => s + pnl(p), 0);
  const totalCost = positions.reduce((s, p) => s + p.avgEntry * p.shares, 0);
  const totalPnlPct = (totalPnl / totalCost) * 100;
  const cashBalance = 100_000 - totalCost;
  const portfolioTotal = totalValue + cashBalance;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'ticker':
          return a.ticker.localeCompare(b.ticker) * mul;
        case 'marketValue':
          return (marketValue(a) - marketValue(b)) * mul;
        case 'pnl':
          return (pnl(a) - pnl(b)) * mul;
        case 'pnlPct':
          return (pnlPct(a) - pnlPct(b)) * mul;
        default:
          return 0;
      }
    });
  }, [sortField, sortDir]);

  // Sector allocation
  const sectorMap = new Map<string, number>();
  for (const p of positions) {
    sectorMap.set(p.sector, (sectorMap.get(p.sector) ?? 0) + marketValue(p));
  }
  const allocations = Array.from(sectorMap.entries())
    .map(([label, val]) => ({
      label,
      pct: (val / totalValue) * 100,
      color: sectorColors[label] ?? 'bg-gray-500',
    }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PieChart className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold text-foreground">Portfolio</h1>
          <p className="text-xs text-muted-foreground">
            {positions.length} positions &middot; Paper trading
          </p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Portfolio Value</span>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">
              ${portfolioTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Unrealized P&L</span>
              {totalPnl >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-profit" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-loss" />
              )}
            </div>
            <p className={cn('mt-1 text-xl font-bold', totalPnl >= 0 ? 'text-profit' : 'text-loss')}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={cn('text-xs', totalPnl >= 0 ? 'text-profit' : 'text-loss')}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Cash Balance</span>
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">
              ${cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Positions</span>
              <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">{positions.length}</p>
            <p className="text-xs text-muted-foreground">
              {((totalValue / portfolioTotal) * 100).toFixed(1)}% invested
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="positions" className="space-y-3">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="allocation">Allocation</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>

        {/* ── Positions Tab ────────────────────────────────────────── */}
        <TabsContent value="positions">
          <Card className="bg-card border-border overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {([
                        ['ticker', 'Ticker'],
                        ['marketValue', 'Market Value'],
                        ['pnl', 'P&L'],
                        ['pnlPct', 'P&L %'],
                      ] as [SortField, string][]).map(([field, label]) => (
                        <th key={field} className="px-4 py-2.5 text-left">
                          <button
                            onClick={() => toggleSort(field)}
                            className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {label}
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 text-left">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Shares
                        </span>
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Avg Entry
                        </span>
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Current
                        </span>
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Sector
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {sortedPositions.map((p) => {
                      const pl = pnl(p);
                      const plPct = pnlPct(p);
                      return (
                        <tr key={p.ticker} className="transition-colors hover:bg-accent/30">
                          <td className="px-4 py-3">
                            <div>
                              <span className="text-sm font-semibold text-foreground">{p.ticker}</span>
                              <p className="text-[11px] text-muted-foreground">{p.name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-mono text-foreground">
                              ${marketValue(p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('text-sm font-mono', pl >= 0 ? 'text-profit' : 'text-loss')}>
                              {pl >= 0 ? '+' : ''}${pl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={cn(
                                'border text-[10px] font-semibold font-mono',
                                plPct >= 0
                                  ? 'bg-profit/15 text-profit border-profit/30'
                                  : 'bg-loss/15 text-loss border-loss/30',
                              )}
                            >
                              {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-mono text-muted-foreground">{p.shares}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-mono text-muted-foreground">${p.avgEntry.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-mono text-foreground">${p.currentPrice.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={cn('border text-[10px]', sectorBadges[p.sector] ?? 'bg-muted text-muted-foreground border-border')}>
                              {p.sector}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Allocation Tab ───────────────────────────────────────── */}
        <TabsContent value="allocation">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sector Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AllocationDonut allocations={allocations} />
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Top Holdings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...positions]
                  .sort((a, b) => marketValue(b) - marketValue(a))
                  .slice(0, 5)
                  .map((p) => {
                    const pct = (marketValue(p) / totalValue) * 100;
                    return (
                      <div key={p.ticker} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{p.ticker}</span>
                          <span className="text-xs font-mono text-muted-foreground">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Risk Tab ─────────────────────────────────────────────── */}
        <TabsContent value="risk">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-profit" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Risk Metrics
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <RiskGauge level={35} label="Portfolio Beta Exposure" />
                <RiskGauge level={22} label="Max Drawdown (30d)" />
                <RiskGauge level={68} label="Concentration (Top 3)" />
                <RiskGauge level={45} label="Sector Tilt" />
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Risk Limits
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <div className="bg-muted/30 px-3 py-1.5">
                    <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                      Current Configuration
                    </p>
                  </div>
                  <div className="divide-y divide-border/50">
                    {[
                      ['Max Position Size', '5%'],
                      ['Max Sector Exposure', '20%'],
                      ['Daily Loss Limit', '2%'],
                      ['Soft Drawdown Halt', '10%'],
                      ['Hard Drawdown Halt', '15%'],
                      ['Max Open Positions', '20'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-xs font-mono font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
