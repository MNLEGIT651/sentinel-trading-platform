'use client';

import { useState, useMemo } from 'react';
import {
  BookOpen,
  TrendingUp,
  Filter,
  Star,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useJournalQuery, useJournalStatsQuery, useGradeJournalMutation } from '@/hooks/queries';
import type { JournalEntry, TradeGrade } from '@sentinel/shared';

// ─── Constants ────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  recommendation: { label: 'Recommendation', color: 'bg-blue-500/15 text-blue-400', icon: Star },
  approval: { label: 'Approved', color: 'bg-green-500/15 text-green-400', icon: CheckCircle },
  rejection: { label: 'Rejected', color: 'bg-red-500/15 text-red-400', icon: XCircle },
  fill: { label: 'Filled', color: 'bg-emerald-500/15 text-emerald-400', icon: TrendingUp },
  risk_block: {
    label: 'Risk Blocked',
    color: 'bg-amber-500/15 text-amber-400',
    icon: AlertTriangle,
  },
  cancellation: { label: 'Cancelled', color: 'bg-zinc-500/15 text-zinc-400', icon: XCircle },
  policy_change: {
    label: 'Policy Change',
    color: 'bg-purple-500/15 text-purple-400',
    icon: Filter,
  },
  manual_note: { label: 'Note', color: 'bg-zinc-500/15 text-zinc-400', icon: BookOpen },
};

const GRADE_OPTIONS: { value: TradeGrade; label: string; color: string }[] = [
  { value: 'excellent', label: 'Excellent', color: 'text-emerald-400' },
  { value: 'good', label: 'Good', color: 'text-green-400' },
  { value: 'neutral', label: 'Neutral', color: 'text-zinc-400' },
  { value: 'bad', label: 'Bad', color: 'text-orange-400' },
  { value: 'terrible', label: 'Terrible', color: 'text-red-400' },
];

const EVENT_FILTER_OPTIONS = [
  { value: '', label: 'All Events' },
  { value: 'recommendation', label: 'Recommendations' },
  { value: 'approval', label: 'Approvals' },
  { value: 'rejection', label: 'Rejections' },
  { value: 'fill', label: 'Fills' },
  { value: 'risk_block', label: 'Risk Blocks' },
  { value: 'policy_change', label: 'Policy Changes' },
  { value: 'manual_note', label: 'Notes' },
];

// ─── Stats Card ───────────────────────────────────────────────────────

function StatsCards() {
  const { data: stats, isLoading } = useJournalStatsQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="p-4">
              <div className="h-4 w-16 animate-pulse rounded bg-zinc-800" />
              <div className="mt-2 h-6 w-10 animate-pulse rounded bg-zinc-800" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const winRate =
    stats.winning_trades + stats.losing_trades > 0
      ? ((stats.winning_trades / (stats.winning_trades + stats.losing_trades)) * 100).toFixed(1)
      : '—';

  const cells = [
    { label: 'Total Entries', value: stats.total_entries },
    { label: 'Approvals', value: stats.approvals },
    { label: 'Rejections', value: stats.rejections },
    { label: 'Fills', value: stats.fills },
    { label: 'Win Rate', value: `${winRate}%` },
    {
      label: 'Avg Return',
      value: stats.avg_return_pct != null ? `${stats.avg_return_pct.toFixed(2)}%` : '—',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cells.map((c) => (
        <Card key={c.label} className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Event Badge ──────────────────────────────────────────────────────

function EventBadge({ type }: { type: string }) {
  const meta = EVENT_TYPE_LABELS[type] ?? {
    label: type,
    color: 'bg-zinc-700/50 text-zinc-400',
    icon: Clock,
  };
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ─── Grade Selector ───────────────────────────────────────────────────

function GradeSelector({
  currentGrade,
  entryId,
}: {
  currentGrade: TradeGrade | null;
  entryId: string;
}) {
  const mutation = useGradeJournalMutation();

  return (
    <div className="flex flex-wrap gap-1">
      {GRADE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => mutation.mutate({ id: entryId, update: { user_grade: opt.value } })}
          disabled={mutation.isPending}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            currentGrade === opt.value
              ? `${opt.color} ring-1 ring-current bg-white/10 font-semibold`
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Timeline Entry ───────────────────────────────────────────────────

function JournalCard({ entry }: { entry: JournalEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ts = new Date(entry.created_at);

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <EventBadge type={entry.event_type} />
            {entry.ticker && (
              <span className="text-sm font-semibold text-zinc-100">{entry.ticker}</span>
            )}
            {entry.direction && (
              <span
                className={`text-xs font-medium ${
                  entry.direction === 'long' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {entry.direction.toUpperCase()}
              </span>
            )}
            {entry.strategy_name && (
              <span className="text-xs text-zinc-500">{entry.strategy_name}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <time dateTime={ts.toISOString()}>
              {ts.toLocaleDateString()}{' '}
              {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </time>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Agent reasoning */}
        {entry.reasoning && (
          <p className="mt-2 text-sm text-zinc-400 line-clamp-2">{entry.reasoning}</p>
        )}

        {/* Quick stats row */}
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
          {entry.confidence != null && (
            <span>Confidence: {(entry.confidence * 100).toFixed(0)}%</span>
          )}
          {entry.quantity != null && <span>Qty: {entry.quantity}</span>}
          {entry.price != null && <span>Price: ${entry.price.toFixed(2)}</span>}
          {entry.outcome_pnl != null && (
            <span className={entry.outcome_pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
              P&L: ${entry.outcome_pnl.toFixed(2)}
            </span>
          )}
          {entry.outcome_return_pct != null && (
            <span className={entry.outcome_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}>
              {entry.outcome_return_pct >= 0 ? '+' : ''}
              {entry.outcome_return_pct.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
            {/* Market context */}
            {(entry.market_regime || entry.vix_at_time != null || entry.sector) && (
              <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                {entry.market_regime && <span>Regime: {entry.market_regime}</span>}
                {entry.vix_at_time != null && <span>VIX: {entry.vix_at_time.toFixed(1)}</span>}
                {entry.sector && <span>Sector: {entry.sector}</span>}
              </div>
            )}

            {/* Reasoning (full) */}
            {entry.reasoning && (
              <div>
                <p className="text-xs font-medium text-zinc-500">Agent Reasoning</p>
                <p className="mt-1 text-sm text-zinc-300 whitespace-pre-wrap">{entry.reasoning}</p>
              </div>
            )}

            {/* User notes */}
            {entry.user_notes && (
              <div>
                <p className="text-xs font-medium text-zinc-500">Notes</p>
                <p className="mt-1 text-sm text-zinc-300">{entry.user_notes}</p>
              </div>
            )}

            {/* Outcome */}
            {entry.outcome_hold_minutes != null && (
              <div className="text-xs text-zinc-500">
                Hold duration:{' '}
                {entry.outcome_hold_minutes < 60
                  ? `${entry.outcome_hold_minutes}m`
                  : `${(entry.outcome_hold_minutes / 60).toFixed(1)}h`}
              </div>
            )}

            {/* Grade */}
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Grade</p>
              <GradeSelector currentGrade={entry.user_grade} entryId={entry.id} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export default function JournalPage() {
  const [eventFilter, setEventFilter] = useState('');
  const [tickerFilter, setTickerFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const filters = useMemo(
    () => ({
      event_type: eventFilter || undefined,
      ticker: tickerFilter || undefined,
      limit: pageSize,
      offset: page * pageSize,
    }),
    [eventFilter, tickerFilter, page],
  );

  const { data, isLoading, isError } = useJournalQuery(filters);
  const entries = data?.entries ?? [];
  const totalEntries = data?.total ?? 0;
  const totalPages = Math.ceil(totalEntries / pageSize);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-zinc-400" />
        <h1 className="text-heading-page text-zinc-100">Decision Journal</h1>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={eventFilter}
          onChange={(e) => {
            setEventFilter(e.target.value);
            setPage(0);
          }}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
        >
          {EVENT_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by ticker…"
          value={tickerFilter}
          onChange={(e) => {
            setTickerFilter(e.target.value.toUpperCase());
            setPage(0);
          }}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none w-36"
        />

        {(eventFilter || tickerFilter) && (
          <button
            onClick={() => {
              setEventFilter('');
              setTickerFilter('');
              setPage(0);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-zinc-600">
          {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Timeline */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-red-900/50 bg-red-950/20">
          <CardContent className="p-6 text-center text-red-400">
            Failed to load journal entries. Please try again.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-zinc-700" />
            <h2 className="mt-4 text-lg font-medium text-zinc-400">No journal entries yet</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Entries are created automatically when you approve, reject, or trade recommendations.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry) => (
            <JournalCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="rounded px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="rounded px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
