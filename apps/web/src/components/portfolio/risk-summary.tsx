'use client';

import { useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  TrendingDown,
  BarChart3,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { cn } from '@/lib/utils';
import { type Position, marketValue } from './positions-table';
import { DEFAULT_TRADING_POLICY } from '@sentinel/shared';

// ── Types ──────────────────────────────────────────────────────────────

export interface RiskSummaryProps {
  positions: Position[];
  portfolioTotal: number;
  totalValue: number;
  totalCost: number;
  totalPnlPct: number;
  allocations: { label: string; pct: number; color: string }[];
}

type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';

interface ConcentrationEntry {
  ticker: string;
  name: string;
  pct: number;
  exceedsLimit: boolean;
}

interface SizingWarning {
  id: string;
  severity: 'warning' | 'critical';
  message: string;
}

interface RiskMetric {
  label: string;
  current: number;
  limit: number;
  unit: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

function computeRiskLevel(metrics: RiskMetric[]): RiskLevel {
  if (metrics.length === 0) return 'low';
  const ratios = metrics.map((m) => (m.limit > 0 ? m.current / m.limit : 0));
  const maxRatio = Math.max(...ratios);
  if (maxRatio >= 1) return 'high';
  if (maxRatio >= 0.75) return 'elevated';
  if (maxRatio >= 0.5) return 'moderate';
  return 'low';
}

const RISK_LEVEL_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; bg: string; icon: typeof ShieldCheck }
> = {
  low: { label: 'Low', color: 'text-profit', bg: 'bg-profit/10', icon: ShieldCheck },
  moderate: { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-400/10', icon: Activity },
  elevated: {
    label: 'Elevated',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    icon: AlertTriangle,
  },
  high: { label: 'High', color: 'text-loss', bg: 'bg-loss/10', icon: ShieldAlert },
};

function RiskLevelBadge({ level }: { level: RiskLevel }) {
  const config = RISK_LEVEL_CONFIG[level];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        config.bg,
        config.color,
      )}
      role="status"
      aria-label={`Overall risk level: ${config.label}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function ConcentrationBar({ pct, exceedsLimit }: { pct: number; exceedsLimit: boolean }) {
  const clampedPct = Math.min(pct, 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          exceedsLimit
            ? 'bg-loss'
            : pct > DEFAULT_TRADING_POLICY.max_position_pct * 0.75
              ? 'bg-amber-500'
              : 'bg-profit',
        )}
        style={{ width: `${clampedPct}%` }}
      />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────

export function RiskSummary({
  positions,
  portfolioTotal,
  totalValue,
  totalCost,
  totalPnlPct,
  allocations,
}: RiskSummaryProps) {
  const maxPositionPct = DEFAULT_TRADING_POLICY.max_position_pct;
  const maxSectorPct = DEFAULT_TRADING_POLICY.max_sector_pct;
  const dailyLossLimitPct = DEFAULT_TRADING_POLICY.daily_loss_limit_pct;
  const maxOpenPositions = DEFAULT_TRADING_POLICY.max_open_positions;

  // Position concentration breakdown
  const concentrations: ConcentrationEntry[] = useMemo(() => {
    if (positions.length === 0 || totalValue <= 0) return [];
    return positions
      .map((p) => {
        const mv = marketValue(p);
        const pct = (mv / portfolioTotal) * 100;
        return {
          ticker: p.ticker,
          name: p.name,
          pct,
          exceedsLimit: pct > maxPositionPct,
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [positions, portfolioTotal, totalValue, maxPositionPct]);

  // Core risk metrics for level computation
  const riskMetrics: RiskMetric[] = useMemo(() => {
    const largestPositionPct =
      positions.length > 0 && totalValue > 0
        ? (Math.max(...positions.map(marketValue)) / portfolioTotal) * 100
        : 0;
    const largestSectorPct = allocations.length > 0 ? (allocations[0]?.pct ?? 0) : 0;
    const drawdownPct = totalCost > 0 ? Math.abs(totalPnlPct) : 0;

    return [
      { label: 'Largest Position', current: largestPositionPct, limit: maxPositionPct, unit: '%' },
      { label: 'Largest Sector', current: largestSectorPct, limit: maxSectorPct, unit: '%' },
      { label: 'Drawdown Exposure', current: drawdownPct, limit: dailyLossLimitPct, unit: '%' },
      { label: 'Open Positions', current: positions.length, limit: maxOpenPositions, unit: '' },
    ];
  }, [
    positions,
    totalValue,
    portfolioTotal,
    allocations,
    totalCost,
    totalPnlPct,
    maxPositionPct,
    maxSectorPct,
    dailyLossLimitPct,
    maxOpenPositions,
  ]);

  const overallLevel = useMemo(() => computeRiskLevel(riskMetrics), [riskMetrics]);

  // Sizing warnings
  const warnings: SizingWarning[] = useMemo(() => {
    const result: SizingWarning[] = [];

    // Position concentration warnings
    for (const c of concentrations) {
      if (c.pct > maxPositionPct) {
        result.push({
          id: `pos-${c.ticker}`,
          severity: 'critical',
          message: `${c.ticker} is ${c.pct.toFixed(1)}% of portfolio (limit: ${maxPositionPct}%)`,
        });
      } else if (c.pct > maxPositionPct * 0.75) {
        result.push({
          id: `pos-warn-${c.ticker}`,
          severity: 'warning',
          message: `${c.ticker} approaching position limit at ${c.pct.toFixed(1)}% (limit: ${maxPositionPct}%)`,
        });
      }
    }

    // Sector concentration warnings
    for (const a of allocations) {
      if (a.pct > maxSectorPct) {
        result.push({
          id: `sector-${a.label}`,
          severity: 'critical',
          message: `${a.label} sector is ${a.pct.toFixed(1)}% of portfolio (limit: ${maxSectorPct}%)`,
        });
      } else if (a.pct > maxSectorPct * 0.75) {
        result.push({
          id: `sector-warn-${a.label}`,
          severity: 'warning',
          message: `${a.label} sector approaching limit at ${a.pct.toFixed(1)}% (limit: ${maxSectorPct}%)`,
        });
      }
    }

    // Drawdown warning
    if (totalCost > 0 && Math.abs(totalPnlPct) > dailyLossLimitPct) {
      result.push({
        id: 'drawdown',
        severity: 'critical',
        message: `Portfolio drawdown at ${Math.abs(totalPnlPct).toFixed(1)}% exceeds daily limit (${dailyLossLimitPct}%)`,
      });
    }

    // Open positions warning
    if (positions.length > maxOpenPositions) {
      result.push({
        id: 'open-positions',
        severity: 'critical',
        message: `${positions.length} open positions exceed limit of ${maxOpenPositions}`,
      });
    } else if (positions.length > maxOpenPositions * 0.75) {
      result.push({
        id: 'open-positions-warn',
        severity: 'warning',
        message: `${positions.length} of ${maxOpenPositions} max positions used`,
      });
    }

    return result;
  }, [
    concentrations,
    allocations,
    totalCost,
    totalPnlPct,
    positions.length,
    maxPositionPct,
    maxSectorPct,
    dailyLossLimitPct,
    maxOpenPositions,
  ]);

  // No-data state
  if (positions.length === 0) {
    return (
      <Card className="bg-muted/30 border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            No positions to analyze. Place a trade to see risk metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="risk-summary">
      {/* Overall risk level + metrics summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Overall Risk Level Card */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overall Risk Level{' '}
                  <InfoTooltip content="Derived from position concentration, sector exposure, drawdown, and open position count relative to policy limits." />
                </CardTitle>
              </div>
              <RiskLevelBadge level={overallLevel} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskMetrics.map((m) => {
              const ratio = m.limit > 0 ? m.current / m.limit : 0;
              const pct = Math.min(ratio * 100, 100);
              const color = ratio >= 1 ? 'bg-loss' : ratio >= 0.75 ? 'bg-amber-500' : 'bg-profit';
              return (
                <div key={m.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                    <span className="text-xs font-mono text-foreground">
                      {m.current.toFixed(m.unit === '%' ? 1 : 0)}
                      {m.unit} / {m.limit}
                      {m.unit}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Sizing Warnings Card */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sizing Alerts{' '}
                <InfoTooltip content="Warnings when positions or sectors approach or exceed policy limits." />
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {warnings.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-profit/5 px-3 py-2.5">
                <ShieldCheck className="h-4 w-4 text-profit" />
                <p className="text-xs text-profit">All positions within policy limits</p>
              </div>
            ) : (
              <div className="space-y-2">
                {warnings.map((w) => (
                  <div
                    key={w.id}
                    className={cn(
                      'flex items-start gap-2 rounded-md px-3 py-2',
                      w.severity === 'critical' ? 'bg-loss/5' : 'bg-amber-500/5',
                    )}
                  >
                    {w.severity === 'critical' ? (
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-loss" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    )}
                    <p
                      className={cn(
                        'text-xs',
                        w.severity === 'critical' ? 'text-loss' : 'text-amber-400',
                      )}
                    >
                      {w.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Position Concentration Breakdown */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Position Concentration{' '}
              <InfoTooltip
                content={`Percentage of total portfolio value per holding. Policy limit: ${maxPositionPct}% per position.`}
              />
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {concentrations.slice(0, 10).map((c) => (
              <div key={c.ticker} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{c.ticker}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      {c.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-xs font-mono',
                        c.exceedsLimit ? 'text-loss font-medium' : 'text-foreground',
                      )}
                    >
                      {c.pct.toFixed(1)}%
                    </span>
                    {c.exceedsLimit && (
                      <TrendingDown className="h-3 w-3 text-loss" aria-label="Exceeds limit" />
                    )}
                  </div>
                </div>
                <ConcentrationBar pct={c.pct} exceedsLimit={c.exceedsLimit} />
              </div>
            ))}
            {concentrations.length > 10 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                + {concentrations.length - 10} more positions
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
