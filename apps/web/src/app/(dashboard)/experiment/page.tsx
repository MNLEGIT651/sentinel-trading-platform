'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Beaker,
  Play,
  Pause,
  SkipForward,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldAlert,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────

interface Experiment {
  id: string;
  name: string;
  description: string | null;
  status: string;
  halted: boolean;
  halt_reason: string | null;
  halted_at: string | null;
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
  updated_at: string;
}

interface ExperimentOrder {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  status: string;
  fill_price: number | null;
  shadow_fill_price: number | null;
  is_shadow: boolean;
  phase: string;
  submitted_at: string;
}

interface ExperimentSnapshot {
  snapshot_date: string;
  phase: string;
  equity: number;
  cumulative_pnl: number;
  cumulative_return_pct: number;
  max_drawdown_pct: number;
  orders_filled: number;
  recommendations_generated: number;
  cycle_count: number;
  error_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'text-muted-foreground', icon: Clock },
  week1_shadow: { label: 'Week 1 — Shadow', color: 'text-blue-400', icon: Activity },
  week2_execution: { label: 'Week 2 — Execution', color: 'text-amber-400', icon: TrendingUp },
  completed: { label: 'Completed', color: 'text-profit', icon: CheckCircle2 },
  aborted: { label: 'Aborted', color: 'text-loss', icon: AlertTriangle },
};

function StatusBadge({ status, halted }: { status: string; halted: boolean }) {
  if (halted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-loss/10 px-2.5 py-0.5 text-xs font-medium text-loss">
        <ShieldAlert className="h-3 w-3" /> HALTED
      </span>
    );
  }
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}
    >
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  const colors: Record<string, string> = {
    go: 'bg-profit/10 text-profit',
    no_go: 'bg-loss/10 text-loss',
    inconclusive: 'bg-amber-500/10 text-amber-400',
  };
  const labels: Record<string, string> = { go: 'GO', no_go: 'NO-GO', inconclusive: 'INCONCLUSIVE' };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold tracking-wider ${colors[verdict] ?? ''}`}
    >
      {labels[verdict] ?? verdict}
    </span>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function ExperimentPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [active, setActive] = useState<Experiment | null>(null);
  const [orders, setOrders] = useState<ExperimentOrder[]>([]);
  const [snapshots, setSnapshots] = useState<ExperimentSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state for new experiment
  const [newName, setNewName] = useState('Paper Trading Trial');
  const [newCapital, setNewCapital] = useState('100000');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/experiments');
      if (!res.ok) return;
      const data = await res.json();
      setExperiments(data);

      const activeExp = data.find((e: Experiment) => !['completed', 'aborted'].includes(e.status));
      setActive(activeExp ?? null);

      if (activeExp) {
        const [ordersRes, reportRes] = await Promise.all([
          fetch(`/api/experiments/${activeExp.id}/report`),
          Promise.resolve(null),
        ]);
        if (ordersRes.ok) {
          const report = await ordersRes.json();
          setOrders(report.orders ?? []);
          setSnapshots(report.snapshots ?? []);
        }
        void reportRes;
      }
    } catch {
      // Silent fetch failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          initial_capital: parseFloat(newCapital) || 100000,
        }),
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (action: 'halt' | 'advance') => {
    if (!active) return;
    setActionLoading(true);
    try {
      const url = `/api/experiments/${active.id}/${action}`;
      const body = action === 'halt' ? { reason: 'Manual halt from dashboard' } : {};
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const latestSnapshot = snapshots[snapshots.length - 1];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Beaker className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Paper Trading Experiment</h1>
            <p className="text-sm text-muted-foreground">
              Two-phase trial: shadow recommendations → bounded paper execution
            </p>
          </div>
        </div>
      </div>

      {/* Active Experiment */}
      {active ? (
        <div className="space-y-4">
          {/* Status bar */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-4">
              <StatusBadge status={active.status} halted={active.halted} />
              <span className="text-sm font-medium">{active.name}</span>
              {active.verdict && <VerdictBadge verdict={active.verdict} />}
            </div>
            <div className="flex items-center gap-2">
              {!active.halted && active.status !== 'pending' && (
                <button
                  onClick={() => handleAction('halt')}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded bg-loss/10 px-3 py-1.5 text-xs font-medium text-loss hover:bg-loss/20 disabled:opacity-50"
                >
                  <Pause className="h-3 w-3" /> Halt
                </button>
              )}
              {active.status !== 'completed' && active.status !== 'aborted' && (
                <button
                  onClick={() => handleAction('advance')}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  {active.status === 'pending' ? (
                    <>
                      <Play className="h-3 w-3" /> Start Week 1
                    </>
                  ) : active.status === 'week1_shadow' ? (
                    <>
                      <SkipForward className="h-3 w-3" /> Start Week 2
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Complete
                    </>
                  )}
                </button>
              )}
              <Link
                href={`/experiment/${active.id}`}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium hover:bg-accent/80"
              >
                Full Report →
              </Link>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <MetricCard
              label="Initial Capital"
              value={`$${active.initial_capital.toLocaleString()}`}
            />
            <MetricCard
              label="Current Equity"
              value={latestSnapshot ? `$${latestSnapshot.equity.toLocaleString()}` : '—'}
            />
            <MetricCard
              label="Cumulative P&L"
              value={latestSnapshot ? `$${latestSnapshot.cumulative_pnl.toLocaleString()}` : '—'}
              sub={
                latestSnapshot ? `${latestSnapshot.cumulative_return_pct.toFixed(2)}%` : undefined
              }
            />
            <MetricCard
              label="Max Drawdown"
              value={latestSnapshot ? `${latestSnapshot.max_drawdown_pct.toFixed(2)}%` : '—'}
            />
            <MetricCard
              label="Orders Filled"
              value={String(orders.filter((o) => o.status === 'filled').length)}
              sub={`of ${orders.length} total`}
            />
            <MetricCard
              label="Cycles Run"
              value={latestSnapshot ? String(latestSnapshot.cycle_count) : '0'}
              sub={latestSnapshot ? `${latestSnapshot.error_count} errors` : undefined}
            />
          </div>

          {/* Risk Caps */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Experiment Risk Caps
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Max Daily Trades</p>
                <p className="font-mono text-sm">{active.max_daily_trades}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max Position Value</p>
                <p className="font-mono text-sm">${active.max_position_value.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Signal Threshold</p>
                <p className="font-mono text-sm">{active.signal_strength_threshold}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max Total Exposure</p>
                <p className="font-mono text-sm">${active.max_total_exposure.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          {orders.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                Recent Orders ({orders.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4">Symbol</th>
                      <th className="pb-2 pr-4">Side</th>
                      <th className="pb-2 pr-4">Qty</th>
                      <th className="pb-2 pr-4">Price</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Phase</th>
                      <th className="pb-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 20).map((order) => (
                      <tr key={order.id} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-mono font-medium">{order.symbol}</td>
                        <td className="py-2 pr-4">
                          <span className={order.side === 'buy' ? 'text-profit' : 'text-loss'}>
                            {order.side === 'buy' ? (
                              <TrendingUp className="inline h-3 w-3" />
                            ) : (
                              <TrendingDown className="inline h-3 w-3" />
                            )}{' '}
                            {order.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono">{order.quantity}</td>
                        <td className="py-2 pr-4 font-mono">
                          {order.is_shadow
                            ? `$${order.shadow_fill_price ?? '—'}`
                            : `$${order.fill_price ?? '—'}`}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs ${
                              order.status === 'filled'
                                ? 'bg-profit/10 text-profit'
                                : order.status === 'rejected'
                                  ? 'bg-loss/10 text-loss'
                                  : 'bg-accent text-muted-foreground'
                            }`}
                          >
                            {order.is_shadow ? '👻 ' : ''}
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {order.phase === 'week1_shadow' ? 'W1' : 'W2'}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {new Date(order.submitted_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* No active experiment — show create form */
        <div className="mx-auto max-w-md space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="text-center">
            <Beaker className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">Start a New Experiment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Run a two-phase paper trading trial with shadow mode and bounded execution.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Initial Capital ($)
              </label>
              <input
                type="number"
                value={newCapital}
                onChange={(e) => setNewCapital(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !newName}
              className="flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? 'Creating…' : 'Create Experiment'}
            </button>
          </div>
        </div>
      )}

      {/* Past Experiments */}
      {experiments.filter((e) => ['completed', 'aborted'].includes(e.status)).length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Past Experiments</h3>
          <div className="space-y-2">
            {experiments
              .filter((e) => ['completed', 'aborted'].includes(e.status))
              .map((exp) => (
                <Link
                  key={exp.id}
                  href={`/experiment/${exp.id}`}
                  className="flex items-center justify-between rounded border border-border/50 p-3 hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={exp.status} halted={false} />
                    <span className="text-sm font-medium">{exp.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <VerdictBadge verdict={exp.verdict} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(exp.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
