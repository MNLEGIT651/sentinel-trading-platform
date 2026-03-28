'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  CheckCircle,
  Shield,
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
  Activity,
  DollarSign,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useFillsQuery, useRiskEvaluationsQuery } from '@/hooks/queries';
import type { Fill, RiskEvaluation, RiskCheck } from '@sentinel/shared';

// ─── Types ──────────────────────────────────────────────────────────────

type TimelineEntryType = 'fill' | 'risk';

interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  timestamp: string;
  data: Fill | RiskEvaluation;
}

type DateRange = 'today' | 'week' | 'month' | 'all';
type TypeFilter = 'all' | 'fills' | 'risk';

// ─── Helpers ────────────────────────────────────────────────────────────

function getDateRangeFrom(range: DateRange): string | undefined {
  if (range === 'all') return undefined;
  const now = new Date();
  if (range === 'today') {
    now.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    now.setDate(now.getDate() - 7);
  } else if (range === 'month') {
    now.setMonth(now.getMonth() - 1);
  }
  return now.toISOString();
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function formatCurrency(val: number): string {
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Type Metadata ──────────────────────────────────────────────────────

const ENTRY_META: Record<TimelineEntryType, { label: string; icon: typeof CheckCircle }> = {
  fill: { label: 'Fill', icon: CheckCircle },
  risk: { label: 'Risk Eval', icon: Shield },
};

function getEntryBadgeColor(entry: TimelineEntry): string {
  if (entry.type === 'fill') {
    return 'bg-green-500/15 text-green-400';
  }
  const risk = entry.data as RiskEvaluation;
  return risk.allowed ? 'bg-orange-500/15 text-orange-400' : 'bg-red-500/15 text-red-400';
}

// ─── Stats Row ──────────────────────────────────────────────────────────

function StatsRow({
  fills,
  riskEvals,
  isLoading,
}: {
  fills: Fill[];
  riskEvals: RiskEvaluation[];
  isLoading: boolean;
}) {
  const stats = useMemo(() => {
    const totalFills = fills.length;
    const totalRiskEvals = riskEvals.length;
    const totalEntries = totalFills + totalRiskEvals;

    const totalCommission = fills.reduce((sum, f) => sum + (f.commission ?? 0), 0);

    const slippageValues = fills.filter((f) => f.slippage != null).map((f) => f.slippage as number);
    const avgSlippage =
      slippageValues.length > 0
        ? slippageValues.reduce((a, b) => a + b, 0) / slippageValues.length
        : null;

    const fillRate = totalEntries > 0 ? ((totalFills / totalEntries) * 100).toFixed(1) : '—';

    return { totalEntries, totalFills, fillRate, totalCommission, avgSlippage };
  }, [fills, riskEvals]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
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

  const cells = [
    {
      label: 'Total Events',
      value: String(stats.totalEntries),
      icon: Activity,
    },
    {
      label: 'Fill Rate',
      value: `${stats.fillRate}%`,
      icon: BarChart3,
    },
    {
      label: 'Total Commission',
      value: formatCurrency(stats.totalCommission),
      icon: DollarSign,
    },
    {
      label: 'Avg Slippage',
      value: stats.avgSlippage != null ? `${stats.avgSlippage.toFixed(4)}` : '—',
      icon: ArrowUpDown,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-zinc-500" />
                <p className="text-xs text-zinc-500">{c.label}</p>
              </div>
              <p className="mt-1 text-lg font-semibold text-zinc-100">{c.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Entry Badge ────────────────────────────────────────────────────────

function EntryBadge({ entry }: { entry: TimelineEntry }) {
  const meta = ENTRY_META[entry.type];
  const color = getEntryBadgeColor(entry);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      <Icon className="h-3 w-3" />
      {entry.type === 'risk'
        ? (entry.data as RiskEvaluation).allowed
          ? 'Allowed'
          : 'Blocked'
        : meta.label}
    </span>
  );
}

// ─── Risk Check Row ─────────────────────────────────────────────────────

function RiskCheckRow({ check }: { check: RiskCheck }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`h-1.5 w-1.5 rounded-full ${check.passed ? 'bg-green-400' : 'bg-red-400'}`}
      />
      <span className="text-zinc-300">{check.name}</span>
      {check.actual != null && check.limit != null && (
        <span className="text-zinc-500">
          ({check.actual} / {check.limit})
        </span>
      )}
      {check.message && <span className="text-zinc-600 truncate max-w-xs">{check.message}</span>}
    </div>
  );
}

// ─── Fill Detail ────────────────────────────────────────────────────────

function FillDetail({ fill }: { fill: Fill }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <span className="text-zinc-500">Order ID</span>
          <p className="text-zinc-300 font-mono text-[11px] truncate">{fill.order_id}</p>
        </div>
        <div>
          <span className="text-zinc-500">Fill Price</span>
          <p className="text-zinc-300">{formatCurrency(fill.fill_price)}</p>
        </div>
        <div>
          <span className="text-zinc-500">Fill Qty</span>
          <p className="text-zinc-300">{fill.fill_qty}</p>
        </div>
        <div>
          <span className="text-zinc-500">Commission</span>
          <p className="text-zinc-300">
            {fill.commission != null ? formatCurrency(fill.commission) : '—'}
          </p>
        </div>
        <div>
          <span className="text-zinc-500">Slippage</span>
          <p className="text-zinc-300">{fill.slippage != null ? fill.slippage.toFixed(4) : '—'}</p>
        </div>
        <div>
          <span className="text-zinc-500">Venue</span>
          <p className="text-zinc-300">{(fill as Fill & { venue?: string | null }).venue ?? '—'}</p>
        </div>
      </div>
      {(fill as Fill & { broker_fill_id?: string | null }).broker_fill_id && (
        <div className="text-xs">
          <span className="text-zinc-500">Broker Fill ID: </span>
          <span className="text-zinc-400 font-mono">
            {(fill as Fill & { broker_fill_id?: string | null }).broker_fill_id}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Risk Eval Detail ───────────────────────────────────────────────────

function RiskEvalDetail({ evaluation }: { evaluation: RiskEvaluation }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <span className="text-zinc-500">Recommendation</span>
          <div className="flex items-center gap-1">
            <p className="text-zinc-300 font-mono text-[11px] truncate">
              {evaluation.recommendation_id}
            </p>
            <Link
              href={`/recommendations/${evaluation.recommendation_id}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
        <div>
          <span className="text-zinc-500">Policy Version</span>
          <p className="text-zinc-300">{evaluation.policy_version ?? '—'}</p>
        </div>
        <div>
          <span className="text-zinc-500">Decision</span>
          <p className={evaluation.allowed ? 'text-green-400' : 'text-red-400'}>
            {evaluation.allowed ? 'Allowed' : 'Blocked'}
          </p>
        </div>
        {evaluation.adjusted_quantity != null && (
          <div>
            <span className="text-zinc-500">Adjusted Qty</span>
            <p className="text-zinc-300">{evaluation.adjusted_quantity}</p>
          </div>
        )}
        {(evaluation as RiskEvaluation & { original_quantity?: number | null }).original_quantity !=
          null && (
          <div>
            <span className="text-zinc-500">Original Qty</span>
            <p className="text-zinc-300">
              {
                (
                  evaluation as RiskEvaluation & {
                    original_quantity?: number | null;
                  }
                ).original_quantity
              }
            </p>
          </div>
        )}
      </div>

      {evaluation.reason && (
        <div className="text-xs">
          <span className="text-zinc-500">Reason: </span>
          <span className="text-zinc-300">{evaluation.reason}</span>
        </div>
      )}

      {evaluation.checks_performed.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-500">
            Checks ({evaluation.checks_performed.length})
          </p>
          <div className="space-y-1">
            {evaluation.checks_performed.map((check, idx) => (
              <RiskCheckRow key={`${check.name}-${idx}`} check={check} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timeline Card ──────────────────────────────────────────────────────

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(() => {
    if (entry.type === 'fill') {
      const fill = entry.data as Fill;
      return {
        primary: `${fill.fill_qty} @ ${formatCurrency(fill.fill_price)}`,
        secondary: fill.order_id ? `Order ${fill.order_id.slice(0, 8)}…` : null,
      };
    }
    const risk = entry.data as RiskEvaluation;
    return {
      primary: risk.allowed
        ? `Approved${risk.adjusted_quantity != null ? ` (qty: ${risk.adjusted_quantity})` : ''}`
        : 'Blocked',
      secondary: risk.reason,
    };
  }, [entry]);

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <EntryBadge entry={entry} />
            <span className="text-sm font-semibold text-zinc-100">{summary.primary}</span>
            {summary.secondary && (
              <span className="text-xs text-zinc-500 truncate max-w-xs">{summary.secondary}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Quick stats */}
        {entry.type === 'fill' && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
            {(entry.data as Fill).commission != null && (
              <span>Commission: {formatCurrency((entry.data as Fill).commission ?? 0)}</span>
            )}
            {(entry.data as Fill).slippage != null && (
              <span>Slippage: {((entry.data as Fill).slippage as number).toFixed(4)}</span>
            )}
          </div>
        )}

        {entry.type === 'risk' && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
            {(entry.data as RiskEvaluation).checks_performed.length > 0 && (
              <span>
                {(entry.data as RiskEvaluation).checks_performed.filter((c) => c.passed).length}/
                {(entry.data as RiskEvaluation).checks_performed.length} checks passed
              </span>
            )}
            {(entry.data as RiskEvaluation).policy_version && (
              <span>Policy: {(entry.data as RiskEvaluation).policy_version}</span>
            )}
          </div>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 border-t border-zinc-800 pt-3">
            {entry.type === 'fill' ? (
              <FillDetail fill={entry.data as Fill} />
            ) : (
              <RiskEvalDetail evaluation={entry.data as RiskEvaluation} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Date Range Buttons ─────────────────────────────────────────────────

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All' },
];

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'fills', label: 'Fills' },
  { value: 'risk', label: 'Risk Evals' },
];

// ─── Main Page ──────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 30;

  const from = useMemo(() => getDateRangeFrom(dateRange), [dateRange]);

  const fillsQuery = useFillsQuery({
    limit: 200,
    from: from,
  });

  const riskQuery = useRiskEvaluationsQuery({
    limit: 200,
  });

  const isLoading = fillsQuery.isLoading || riskQuery.isLoading;
  const isError = fillsQuery.isError || riskQuery.isError;

  const fills = useMemo(() => fillsQuery.data?.data ?? [], [fillsQuery.data]);
  const riskEvals = useMemo(() => riskQuery.data?.data ?? [], [riskQuery.data]);

  // Build unified timeline
  const timeline = useMemo(() => {
    const entries: TimelineEntry[] = [];

    if (typeFilter === 'all' || typeFilter === 'fills') {
      for (const fill of fills) {
        entries.push({
          id: `fill-${fill.id}`,
          type: 'fill',
          timestamp: fill.fill_ts,
          data: fill,
        });
      }
    }

    if (typeFilter === 'all' || typeFilter === 'risk') {
      for (const risk of riskEvals) {
        // Filter risk evals by date range client-side
        if (from && new Date(risk.evaluated_at) < new Date(from)) {
          continue;
        }
        entries.push({
          id: `risk-${risk.id}`,
          type: 'risk',
          timestamp: risk.evaluated_at,
          data: risk,
        });
      }
    }

    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Symbol search — filter fills by order_id (partial match)
    if (symbolSearch.trim()) {
      const q = symbolSearch.trim().toLowerCase();
      return entries.filter((e) => {
        if (e.type === 'fill') {
          const fill = e.data as Fill;
          return fill.order_id.toLowerCase().includes(q) || fill.id.toLowerCase().includes(q);
        }
        if (e.type === 'risk') {
          const risk = e.data as RiskEvaluation;
          return (
            risk.recommendation_id.toLowerCase().includes(q) ||
            risk.id.toLowerCase().includes(q) ||
            (risk.reason?.toLowerCase().includes(q) ?? false)
          );
        }
        return true;
      });
    }

    return entries;
  }, [fills, riskEvals, typeFilter, from, symbolSearch]);

  // Paginate
  const totalEntries = timeline.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const pagedEntries = timeline.slice(page * pageSize, (page + 1) * pageSize);

  const handleDateRange = useCallback((range: DateRange) => {
    setDateRange(range);
    setPage(0);
  }, []);

  const handleTypeFilter = useCallback((filter: TypeFilter) => {
    setTypeFilter(filter);
    setPage(0);
  }, []);

  const handleClearFilters = useCallback(() => {
    setDateRange('all');
    setTypeFilter('all');
    setSymbolSearch('');
    setPage(0);
  }, []);

  const hasFilters = dateRange !== 'all' || typeFilter !== 'all' || symbolSearch !== '';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <ArrowUpDown className="h-6 w-6 text-zinc-400" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Orders &amp; Fills</h1>
          <p className="text-sm text-zinc-500">Execution activity timeline</p>
        </div>
      </div>

      {/* Stats */}
      <StatsRow fills={fills} riskEvals={riskEvals} isLoading={isLoading} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range */}
        <div className="flex rounded-md border border-zinc-700 overflow-hidden">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleDateRange(opt.value)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                dateRange === opt.value
                  ? 'bg-zinc-700 text-zinc-100 font-medium'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => handleTypeFilter(e.target.value as TypeFilter)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
        >
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Symbol / ID search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search ID or reason…"
            value={symbolSearch}
            onChange={(e) => {
              setSymbolSearch(e.target.value);
              setPage(0);
            }}
            className="rounded-md border border-zinc-700 bg-zinc-900 py-1.5 pl-8 pr-3 text-sm text-zinc-300 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none w-48"
          />
        </div>

        {hasFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-zinc-600">
          {totalEntries} {totalEntries === 1 ? 'event' : 'events'}
        </span>
      </div>

      {/* Timeline */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
                  <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
                </div>
                <div className="mt-2 h-3 w-48 animate-pulse rounded bg-zinc-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-red-900/50 bg-red-950/20">
          <CardContent className="p-6 text-center text-red-400">
            Failed to load execution data. Please try again.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && pagedEntries.length === 0 && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-12 text-center">
            <Activity className="mx-auto h-10 w-10 text-zinc-700" />
            <h3 className="mt-4 text-lg font-medium text-zinc-400">No execution activity yet</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Fills and risk evaluations will appear here as trades are executed.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && pagedEntries.length > 0 && (
        <div className="space-y-3">
          {pagedEntries.map((entry) => (
            <TimelineCard key={entry.id} entry={entry} />
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
