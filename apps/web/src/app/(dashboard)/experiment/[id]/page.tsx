'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Beaker,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { InfoTooltip } from '@/components/ui/info-tooltip';

// ─── Types ────────────────────────────────────────────────────────────

interface Experiment {
  id: string;
  name: string;
  description: string | null;
  status: string;
  halted: boolean;
  halt_reason: string | null;
  week1_start: string | null;
  week1_end: string | null;
  week2_start: string | null;
  week2_end: string | null;
  max_daily_trades: number;
  max_position_value: number;
  signal_strength_threshold: number;
  max_total_exposure: number;
  initial_capital: number;
  verdict: string | null;
  verdict_reason: string | null;
  final_metrics: Record<string, unknown> | null;
  created_at: string;
}

interface Snapshot {
  snapshot_date: string;
  phase: string;
  equity: number;
  cash: number;
  positions_value: number;
  daily_pnl: number;
  cumulative_pnl: number;
  cumulative_return_pct: number;
  max_drawdown_pct: number;
  recommendations_generated: number;
  recommendations_executed: number;
  recommendations_blocked: number;
  orders_submitted: number;
  orders_filled: number;
  orders_rejected: number;
  sharpe_ratio: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  cycle_count: number;
  error_count: number;
}

interface Order {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  status: string;
  fill_price: number | null;
  shadow_fill_price: number | null;
  shadow_pnl: number | null;
  is_shadow: boolean;
  phase: string;
  submitted_at: string;
}

interface ReportSummary {
  total_orders: number;
  filled_orders: number;
  shadow_orders: number;
  total_pnl: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  avg_sharpe: number | null;
  avg_win_rate: number | null;
}

interface Report {
  experiment: Experiment;
  snapshots: Snapshot[];
  orders: Order[];
  summary: ReportSummary;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function VerdictBanner({ verdict, reason }: { verdict: string; reason: string | null }) {
  const config: Record<
    string,
    { bg: string; text: string; icon: typeof CheckCircle2; label: string }
  > = {
    go: {
      bg: 'bg-profit/10 border-profit/30',
      text: 'text-profit',
      icon: CheckCircle2,
      label: 'GO — Ready for Next Phase',
    },
    no_go: {
      bg: 'bg-loss/10 border-loss/30',
      text: 'text-loss',
      icon: XCircle,
      label: 'NO GO — Does Not Meet Thresholds',
    },
    inconclusive: {
      bg: 'bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-400',
      icon: AlertTriangle,
      label: 'INCONCLUSIVE — More Data Needed',
    },
  };
  const c = config[verdict] ?? config.inconclusive!;
  if (!c) return null;
  const Icon = c.icon;

  return (
    <div className={`rounded-lg border ${c.bg} p-4`}>
      <div className={`flex items-center gap-2 ${c.text}`}>
        <Icon className="h-5 w-5" />
        <span className="text-lg font-bold">{c.label}</span>
      </div>
      {reason && <p className="mt-2 text-sm text-muted-foreground">{reason}</p>}
    </div>
  );
}

function StatRow({
  label,
  value,
  format,
}: {
  label: React.ReactNode;
  value: number | null | undefined;
  format?: string;
}) {
  let display = '—';
  if (value != null) {
    if (format === 'currency')
      display = `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    else if (format === 'pct') display = `${value.toFixed(2)}%`;
    else if (format === 'ratio') display = value.toFixed(3);
    else display = value.toLocaleString();
  }
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-medium">{display}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function ExperimentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/experiments/${id}/report`);
      if (!res.ok) {
        setError('Failed to load experiment report');
        return;
      }
      const data = await res.json();
      setReport(data);
    } catch {
      setError('Failed to load experiment report');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2">
        <AlertTriangle className="h-8 w-8 text-loss" />
        <p className="text-sm text-muted-foreground">{error ?? 'Experiment not found'}</p>
        <Link href="/experiment" className="text-sm text-primary hover:underline">
          ← Back
        </Link>
      </div>
    );
  }

  const { experiment: exp, snapshots, orders, summary } = report;
  const week1Snapshots = snapshots.filter((s) => s.phase === 'week1_shadow');
  const week2Snapshots = snapshots.filter((s) => s.phase === 'week2_execution');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/experiment" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Beaker className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-heading-page">{exp.name}</h1>
          <p className="text-sm text-muted-foreground">
            Created {new Date(exp.created_at).toLocaleDateString()}
            {exp.description && ` — ${exp.description}`}
          </p>
        </div>
      </div>

      {/* Verdict */}
      {exp.verdict && <VerdictBanner verdict={exp.verdict} reason={exp.verdict_reason} />}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Profitability */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Profitability</h3>
          <StatRow label="Total P&L" value={summary.total_pnl} format="currency" />
          <StatRow label="Total Return" value={summary.total_return_pct} format="pct" />
          <StatRow
            label={
              <>
                Max Drawdown{' '}
                <InfoTooltip content="Largest peak-to-trough decline in portfolio value. Lower is better." />
              </>
            }
            value={summary.max_drawdown_pct}
            format="pct"
          />
          <StatRow
            label={
              <>
                Sharpe Ratio{' '}
                <InfoTooltip content="Risk-adjusted return metric. Values above 1.0 indicate good risk-adjusted performance." />
              </>
            }
            value={summary.avg_sharpe}
            format="ratio"
          />
          <StatRow
            label={
              <>
                Win Rate <InfoTooltip content="Percentage of trades that were profitable." />
              </>
            }
            value={summary.avg_win_rate != null ? summary.avg_win_rate * 100 : null}
            format="pct"
          />
        </div>

        {/* Activity */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Activity</h3>
          <StatRow label="Total Orders" value={summary.total_orders} />
          <StatRow label="Filled Orders" value={summary.filled_orders} />
          <StatRow label="Shadow Orders" value={summary.shadow_orders} />
          <StatRow label="Initial Capital" value={exp.initial_capital} format="currency" />
        </div>

        {/* Configuration */}
        <CollapsibleCard title="Risk Caps" defaultOpen={false} className="bg-card border-border">
          <StatRow label="Max Daily Trades" value={exp.max_daily_trades} />
          <StatRow label="Max Position Value" value={exp.max_position_value} format="currency" />
          <StatRow label="Signal Threshold" value={exp.signal_strength_threshold} format="ratio" />
          <StatRow label="Max Total Exposure" value={exp.max_total_exposure} format="currency" />
        </CollapsibleCard>
      </div>

      {/* Phase Timeline */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Phase Timeline</h3>
        <div className="flex items-center gap-2">
          {[
            { label: 'Created', date: exp.created_at, done: true },
            { label: 'Week 1 Start', date: exp.week1_start, done: !!exp.week1_start },
            { label: 'Week 1 End', date: exp.week1_end, done: !!exp.week1_end },
            { label: 'Week 2 Start', date: exp.week2_start, done: !!exp.week2_start },
            { label: 'Week 2 End', date: exp.week2_end, done: !!exp.week2_end },
          ].map((step, i) => (
            <div key={i} className="flex flex-1 flex-col items-center">
              <div className={`h-3 w-3 rounded-full ${step.done ? 'bg-primary' : 'bg-border'}`} />
              <p className="mt-1 text-[10px] font-medium">{step.label}</p>
              <p className="text-[9px] text-muted-foreground">
                {step.date ? new Date(step.date).toLocaleDateString() : '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Week 1 vs Week 2 Comparison */}
      {week1Snapshots.length > 0 && week2Snapshots.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Week 1 (Shadow) vs Week 2 (Execution)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2">Metric</th>
                <th className="pb-2 text-right">Week 1 (Shadow)</th>
                <th className="pb-2 text-right">Week 2 (Execution)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const w1Last = week1Snapshots[week1Snapshots.length - 1];
                const w2Last = week2Snapshots[week2Snapshots.length - 1];
                if (!w1Last || !w2Last) return null;
                return (
                  <>
                    <tr className="border-b border-border/50">
                      <td className="py-1.5">Cumulative P&L</td>
                      <td className="py-1.5 text-right font-mono">
                        ${w1Last.cumulative_pnl.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        ${w2Last.cumulative_pnl.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-1.5">Max Drawdown</td>
                      <td className="py-1.5 text-right font-mono">
                        {w1Last.max_drawdown_pct.toFixed(2)}%
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {w2Last.max_drawdown_pct.toFixed(2)}%
                      </td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-1.5">Orders Filled</td>
                      <td className="py-1.5 text-right font-mono">{w1Last.orders_filled}</td>
                      <td className="py-1.5 text-right font-mono">{w2Last.orders_filled}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-1.5">Sharpe Ratio</td>
                      <td className="py-1.5 text-right font-mono">
                        {w1Last.sharpe_ratio?.toFixed(3) ?? '—'}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {w2Last.sharpe_ratio?.toFixed(3) ?? '—'}
                      </td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      {snapshots.length > 0 && (
        <CollapsibleCard
          title="Daily Snapshots"
          summary={`${snapshots.length} days`}
          defaultOpen={false}
          className="bg-card border-border"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Phase</th>
                  <th className="pb-2 text-right">Equity</th>
                  <th className="pb-2 text-right">Daily P&L</th>
                  <th className="pb-2 text-right">Cumul. Return</th>
                  <th className="pb-2 text-right">Drawdown</th>
                  <th className="pb-2 text-right">Fills</th>
                  <th className="pb-2 text-right">Cycles</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.snapshot_date} className="border-b border-border/50">
                    <td className="py-1.5 font-mono text-xs">{s.snapshot_date}</td>
                    <td className="py-1.5">
                      <span
                        className={`text-xs ${s.phase === 'week1_shadow' ? 'text-blue-400' : 'text-amber-400'}`}
                      >
                        {s.phase === 'week1_shadow' ? 'Shadow' : 'Execution'}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono">${s.equity.toLocaleString()}</td>
                    <td
                      className={`py-1.5 text-right font-mono ${s.daily_pnl >= 0 ? 'text-profit' : 'text-loss'}`}
                    >
                      {s.daily_pnl >= 0 ? '+' : ''}${s.daily_pnl.toLocaleString()}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {s.cumulative_return_pct.toFixed(2)}%
                    </td>
                    <td className="py-1.5 text-right font-mono text-loss">
                      {s.max_drawdown_pct.toFixed(2)}%
                    </td>
                    <td className="py-1.5 text-right font-mono">{s.orders_filled}</td>
                    <td className="py-1.5 text-right font-mono">{s.cycle_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      )}

      {orders.length > 0 && (
        <CollapsibleCard
          title="All Orders"
          summary={`${orders.length} orders`}
          defaultOpen={false}
          className="bg-card border-border"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Side</th>
                  <th className="pb-2">Qty</th>
                  <th className="pb-2">Fill Price</th>
                  <th className="pb-2">Shadow P&L</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50">
                    <td className="py-1.5 font-mono font-medium">{o.symbol}</td>
                    <td className="py-1.5">
                      <span className={o.side === 'buy' ? 'text-profit' : 'text-loss'}>
                        {o.side === 'buy' ? (
                          <TrendingUp className="inline h-3 w-3" />
                        ) : (
                          <TrendingDown className="inline h-3 w-3" />
                        )}{' '}
                        {o.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-1.5 font-mono">{o.quantity}</td>
                    <td className="py-1.5 font-mono">
                      ${(o.is_shadow ? o.shadow_fill_price : o.fill_price)?.toFixed(2) ?? '—'}
                    </td>
                    <td
                      className={`py-1.5 font-mono ${(o.shadow_pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}
                    >
                      {o.shadow_pnl != null ? `$${o.shadow_pnl.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          o.status === 'filled'
                            ? 'bg-profit/10 text-profit'
                            : o.status === 'rejected'
                              ? 'bg-loss/10 text-loss'
                              : 'bg-accent text-muted-foreground'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-xs text-muted-foreground">
                      {o.is_shadow ? (
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Shadow
                        </span>
                      ) : (
                        'Paper'
                      )}
                    </td>
                    <td className="py-1.5 text-xs text-muted-foreground">
                      {new Date(o.submitted_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}
