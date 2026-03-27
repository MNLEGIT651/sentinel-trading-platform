'use client';

import { cn } from '@/lib/utils';
import type { HealthLabel, HealthTrend, FrequencyTrend } from '@sentinel/shared';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ── Health label config ─────────────────────────────────────────────

const LABEL_CONFIG: Record<HealthLabel, { bg: string; text: string; dot: string; label: string }> =
  {
    healthy: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400',
      label: 'Healthy',
    },
    warning: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
      label: 'Warning',
    },
    critical: {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      dot: 'bg-red-400',
      label: 'Critical',
    },
    inactive: {
      bg: 'bg-zinc-500/10',
      text: 'text-zinc-400',
      dot: 'bg-zinc-400',
      label: 'Inactive',
    },
    new: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      dot: 'bg-blue-400',
      label: 'New',
    },
  };

// ── Trend icon helper ───────────────────────────────────────────────

function TrendIcon({
  trend,
  className,
}: {
  trend: HealthTrend | FrequencyTrend | null;
  className?: string;
}) {
  if (!trend) return <Minus className={cn('h-3 w-3 text-muted-foreground', className)} />;
  if (trend === 'improving' || trend === 'increasing')
    return <TrendingUp className={cn('h-3 w-3 text-emerald-400', className)} />;
  if (trend === 'degrading' || trend === 'decreasing')
    return <TrendingDown className={cn('h-3 w-3 text-red-400', className)} />;
  return <Minus className={cn('h-3 w-3 text-muted-foreground', className)} />;
}

// ── Health Badge ────────────────────────────────────────────────────

interface HealthBadgeProps {
  score: number | null;
  label: HealthLabel | null;
  compact?: boolean;
}

export function HealthBadge({ score, label, compact = false }: HealthBadgeProps) {
  const config = LABEL_CONFIG[label ?? 'new'] ?? LABEL_CONFIG.new;

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
          config.bg,
          config.text,
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
        {score !== null ? score : '—'}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
        config.bg,
        config.text,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', config.dot)} />
      {config.label}
      {score !== null && <span className="ml-0.5 font-mono text-[10px] opacity-70">{score}</span>}
    </span>
  );
}

// ── Health Metrics Card ─────────────────────────────────────────────

interface HealthMetric {
  label: string;
  value: string | number | null;
  trend?: HealthTrend | FrequencyTrend | null;
  suffix?: string;
}

interface HealthMetricsCardProps {
  strategyName: string;
  metrics: HealthMetric[];
  healthScore: number | null;
  healthLabel: HealthLabel | null;
  windowDays: number;
  computedAt: string;
  onClick?: () => void;
}

export function HealthMetricsCard({
  strategyName,
  metrics,
  healthScore,
  healthLabel,
  windowDays,
  computedAt,
  onClick,
}: HealthMetricsCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 space-y-3 transition-colors',
        onClick && 'cursor-pointer hover:bg-accent/30',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {strategyName
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')}
        </h3>
        <HealthBadge score={healthScore} label={healthLabel} />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {m.label}
              </span>
              {m.trend && <TrendIcon trend={m.trend} />}
            </div>
            <span className="text-sm font-mono text-foreground">
              {m.value !== null && m.value !== undefined ? m.value : '—'}
              {m.suffix && m.value !== null && (
                <span className="text-[10px] text-muted-foreground ml-0.5">{m.suffix}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{windowDays}d window</span>
        <span>{new Date(computedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

// ── Policy Diff Panel ───────────────────────────────────────────────

interface PolicyImpact {
  metric: string;
  current: number;
  projected: number;
  limit: number;
  unit: string;
}

interface PolicyDiffPanelProps {
  impacts: PolicyImpact[];
  ticker: string;
  side: string;
  quantity: number;
}

export function PolicyDiffPanel({ impacts, ticker, side, quantity }: PolicyDiffPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Risk Impact
        </h4>
        <span className="text-[10px] text-muted-foreground">
          {side.toUpperCase()} {quantity} {ticker}
        </span>
      </div>

      <div className="space-y-2">
        {impacts.map((impact) => {
          const delta = impact.projected - impact.current;
          const headroom = impact.limit - impact.projected;
          const isWarning = headroom < impact.limit * 0.2;
          const isDanger = headroom < 0;

          return (
            <div key={impact.metric} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{impact.metric}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-foreground">
                    {impact.current.toFixed(1)}
                    {impact.unit}
                  </span>
                  {delta >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-amber-400" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-emerald-400" />
                  )}
                  <span
                    className={cn(
                      'font-mono',
                      isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-foreground',
                    )}
                  >
                    {impact.projected.toFixed(1)}
                    {impact.unit}
                  </span>
                </div>
              </div>

              {/* Progress bar showing headroom */}
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    isDanger ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-emerald-400',
                  )}
                  style={{ width: `${Math.min(100, (impact.projected / impact.limit) * 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0{impact.unit}</span>
                <span>
                  Limit: {impact.limit}
                  {impact.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
