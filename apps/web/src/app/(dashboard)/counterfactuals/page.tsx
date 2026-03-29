'use client';

import { useState } from 'react';
import {
  GitCompareArrows,
  TrendingUp,
  XCircle,
  ShieldAlert,
  DollarSign,
  BarChart3,
  Target,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { useCounterfactualsQuery } from '@/hooks/queries';
import type {
  CounterfactualResult,
  CounterfactualStats,
} from '@/hooks/queries/use-counterfactuals-query';

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subtext,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string | undefined;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-zinc-100">{value}</div>
      {subtext && <div className="mt-0.5 text-xs text-zinc-500">{subtext}</div>}
    </div>
  );
}

function StatsGrid({ stats }: { stats: CounterfactualStats }) {
  const totalAnalyzed = stats.would_be_winners + stats.would_be_losers;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Rejected"
        value={stats.total_rejected}
        icon={XCircle}
        color="text-red-400"
        subtext="by operator"
      />
      <StatCard
        label="Risk Blocked"
        value={stats.total_risk_blocked}
        icon={ShieldAlert}
        color="text-amber-400"
        subtext="by policy"
      />
      <StatCard
        label="Would-Be Winners"
        value={stats.would_be_winners}
        icon={TrendingUp}
        color="text-emerald-400"
        subtext={totalAnalyzed > 0 ? `of ${totalAnalyzed} analyzed` : undefined}
      />
      <StatCard
        label="Win Rate"
        value={`${stats.win_rate_pct}%`}
        icon={Target}
        color="text-blue-400"
        subtext="if all approved"
      />
      <StatCard
        label="Missed P&L"
        value={`$${stats.total_missed_pnl.toLocaleString()}`}
        icon={DollarSign}
        color={stats.total_missed_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
        subtext="hypothetical total"
      />
      <StatCard
        label="Avg Return"
        value={`${stats.avg_hypothetical_return_pct}%`}
        icon={BarChart3}
        color={stats.avg_hypothetical_return_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}
        subtext="hypothetical avg"
      />
    </div>
  );
}

function CounterfactualCard({ item }: { item: CounterfactualResult }) {
  const [expanded, setExpanded] = useState(false);
  const rec = item.recommendation;

  const pnlColor =
    item.hypothetical_pnl === null
      ? 'text-zinc-500'
      : item.hypothetical_pnl >= 0
        ? 'text-emerald-400'
        : 'text-red-400';

  const returnColor =
    item.hypothetical_return_pct === null
      ? 'text-zinc-500'
      : item.hypothetical_return_pct >= 0
        ? 'text-emerald-400'
        : 'text-red-400';

  const statusBadge =
    rec.status === 'rejected' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
        <XCircle className="h-3 w-3" />
        Rejected
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
        <ShieldAlert className="h-3 w-3" />
        Risk Blocked
      </span>
    );

  const sideBadge = (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
        rec.side === 'buy' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
      }`}
    >
      {rec.side.toUpperCase()}
    </span>
  );

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-zinc-700">
      <button
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="mt-0.5 text-zinc-500">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-zinc-100">{rec.ticker}</span>
            {sideBadge}
            {statusBadge}
            <span className="text-xs text-zinc-500">
              {rec.quantity} shares · {item.days_since_rejection}d ago
            </span>
          </div>

          {/* Hypothetical outcome row */}
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-zinc-500">Entry: </span>
              <span className="text-zinc-300">
                {item.entry_price !== null ? `$${item.entry_price.toFixed(2)}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Now: </span>
              <span className="text-zinc-300">
                {item.current_price !== null ? `$${item.current_price.toFixed(2)}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">P&L: </span>
              <span className={pnlColor}>
                {item.hypothetical_pnl !== null
                  ? `${item.hypothetical_pnl >= 0 ? '+' : ''}$${item.hypothetical_pnl.toLocaleString()}`
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Return: </span>
              <span className={returnColor}>
                {item.hypothetical_return_pct !== null
                  ? `${item.hypothetical_return_pct >= 0 ? '+' : ''}${item.hypothetical_return_pct}%`
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Right side P&L summary */}
        <div className="text-right">
          <div className={`text-lg font-semibold ${pnlColor}`}>
            {item.hypothetical_pnl !== null
              ? `${item.hypothetical_pnl >= 0 ? '+' : ''}$${item.hypothetical_pnl.toLocaleString()}`
              : '—'}
          </div>
          <div className={`text-xs ${returnColor}`}>
            {item.hypothetical_return_pct !== null
              ? `${item.hypothetical_return_pct >= 0 ? '+' : ''}${item.hypothetical_return_pct}%`
              : 'no price data'}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-zinc-500">Strategy</div>
              <div className="text-sm text-zinc-300">{rec.strategy_name ?? 'Unknown'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-500">Confidence</div>
              <div className="text-sm text-zinc-300">
                {rec.signal_strength !== null ? `${(rec.signal_strength * 100).toFixed(0)}%` : '—'}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs font-medium text-zinc-500">Reasoning</div>
              <div className="mt-0.5 text-sm text-zinc-400">
                {rec.reason ?? 'No reason provided'}
              </div>
            </div>
            {rec.status === 'risk_blocked' &&
              rec.metadata &&
              typeof rec.metadata === 'object' &&
              'block_reason' in rec.metadata && (
                <div className="sm:col-span-2">
                  <div className="text-xs font-medium text-amber-500">Block Reason</div>
                  <div className="mt-0.5 text-sm text-amber-400/80">
                    {String(rec.metadata.block_reason)}
                  </div>
                </div>
              )}
            <div>
              <div className="text-xs font-medium text-zinc-500">Order Type</div>
              <div className="text-sm text-zinc-300">
                {rec.order_type}
                {rec.limit_price ? ` @ $${rec.limit_price}` : ''}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-500">Date</div>
              <div className="text-sm text-zinc-300">
                {new Date(rec.reviewed_at ?? rec.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {!item.price_available && (
            <div className="mt-3 flex items-center gap-2 rounded border border-amber-800/40 bg-amber-950/20 p-2 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Price data unavailable — engine may be offline. P&L estimates require live market
              data.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CounterfactualsPage() {
  const [filterStatus, setFilterStatus] = useState<'all' | 'rejected' | 'risk_blocked'>('all');
  const { data, isLoading, error } = useCounterfactualsQuery(100, 0);

  const counterfactuals = data?.counterfactuals ?? [];
  const stats = data?.stats;

  const filtered =
    filterStatus === 'all'
      ? counterfactuals
      : counterfactuals.filter((c) => c.recommendation.status === filterStatus);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <GitCompareArrows className="h-6 w-6 text-violet-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Counterfactuals</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          What if you had approved these recommendations? Hypothetical outcomes based on market
          movement since rejection.
        </p>
      </div>

      {/* Stats */}
      {stats && <StatsGrid stats={stats} />}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Filter:</span>
        {(['all', 'rejected', 'risk_blocked'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              filterStatus === status
                ? 'bg-violet-500/20 text-violet-300'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {status === 'all' ? 'All' : status === 'rejected' ? 'Rejected' : 'Risk Blocked'}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-500">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Loading / Error / Empty */}
      {isLoading && (
        <div className="py-12 text-center text-sm text-zinc-500">Loading counterfactuals…</div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-400">
          Failed to load counterfactuals: {error.message}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="py-12 text-center">
          <GitCompareArrows className="mx-auto h-10 w-10 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">
            No rejected or risk-blocked recommendations yet.
          </p>
          <p className="text-xs text-zinc-600">
            When recommendations are rejected or blocked by risk policy, they will appear here with
            hypothetical P&L.
          </p>
        </div>
      )}

      {/* Results */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((item) => (
            <CounterfactualCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
