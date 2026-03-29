'use client';

import { useState } from 'react';
import {
  Database,
  AlertTriangle,
  AlertCircle,
  Info,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Filter,
  Wifi,
  WifiOff,
  BarChart3,
  Zap,
} from 'lucide-react';
import { useDataQualityQuery, useResolveEventsMutation } from '@/hooks/queries';
import type { DataQualityEvent, DataQualityEventType, DataQualitySeverity } from '@/hooks/queries';

// ── Constants ───────────────────────────────────────────────────────────────

const EVENT_TYPE_META: Record<
  DataQualityEventType,
  { label: string; icon: React.ElementType; color: string }
> = {
  stale_quote: { label: 'Stale Quote', icon: Clock, color: 'text-amber-400' },
  missing_bars: { label: 'Missing Bars', icon: BarChart3, color: 'text-red-400' },
  delayed_quote: { label: 'Delayed Quote', icon: Clock, color: 'text-orange-400' },
  provider_fallback: { label: 'Provider Fallback', icon: RefreshCw, color: 'text-violet-400' },
  cache_miss: { label: 'Cache Miss', icon: WifiOff, color: 'text-zinc-400' },
  cache_hit: { label: 'Cache Hit', icon: Wifi, color: 'text-emerald-400' },
  data_gap: { label: 'Data Gap', icon: XCircle, color: 'text-red-400' },
  api_error: { label: 'API Error', icon: AlertCircle, color: 'text-red-500' },
  rate_limited: { label: 'Rate Limited', icon: Zap, color: 'text-amber-500' },
};

const SEVERITY_META: Record<
  DataQualitySeverity,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  info: { label: 'Info', icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/15' },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
  },
  error: { label: 'Error', icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/15' },
  critical: { label: 'Critical', icon: Flame, color: 'text-red-500', bg: 'bg-red-600/15' },
};

// ── Stats Grid ──────────────────────────────────────────────────────────────

function StatsGrid({
  stats,
}: {
  stats: {
    total: number;
    unresolved: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
  };
}) {
  const severityCounts = stats.by_severity;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="text-xs text-zinc-500">Total Events</div>
        <div className="mt-1 text-2xl font-bold text-zinc-100">{stats.total}</div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="text-xs text-zinc-500">Unresolved</div>
        <div className="mt-1 text-2xl font-bold text-amber-400">{stats.unresolved}</div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="text-xs text-zinc-500">Errors</div>
        <div className="mt-1 text-2xl font-bold text-red-400">
          {(severityCounts['error'] ?? 0) + (severityCounts['critical'] ?? 0)}
        </div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="text-xs text-zinc-500">Warnings</div>
        <div className="mt-1 text-2xl font-bold text-amber-300">
          {severityCounts['warning'] ?? 0}
        </div>
      </div>
    </div>
  );
}

// ── Event Row ───────────────────────────────────────────────────────────────

function EventRow({
  event,
  selected,
  onSelect,
}: {
  event: DataQualityEvent;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const typeMeta = EVENT_TYPE_META[event.event_type];
  const sevMeta = SEVERITY_META[event.severity];
  const TypeIcon = typeMeta?.icon ?? Info;
  const SevIcon = sevMeta?.icon ?? Info;

  return (
    <div
      className={`flex items-start gap-3 border-b border-zinc-800/50 px-4 py-3 transition-colors hover:bg-zinc-800/30 ${
        event.resolved ? 'opacity-50' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(event.id)}
        className="mt-1 accent-violet-500"
      />

      <div className={`mt-0.5 shrink-0 ${sevMeta?.color ?? 'text-zinc-400'}`}>
        <SevIcon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 text-xs font-medium ${typeMeta?.color ?? 'text-zinc-400'}`}
          >
            <TypeIcon className="h-3 w-3" />
            {typeMeta?.label ?? event.event_type}
          </span>
          {event.ticker && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-mono text-zinc-300">
              {event.ticker}
            </span>
          )}
          {event.provider && <span className="text-xs text-zinc-600">{event.provider}</span>}
          {event.resolved && (
            <span className="flex items-center gap-0.5 text-xs text-emerald-500">
              <CheckCircle2 className="h-3 w-3" /> Resolved
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-zinc-300">{event.message}</p>
      </div>

      <div className="shrink-0 text-right text-xs text-zinc-600">
        {new Date(event.created_at).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DataQualityPage() {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [showResolved, setShowResolved] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading, refetch } = useDataQualityQuery({
    event_type: eventTypeFilter || undefined,
    severity: severityFilter || undefined,
    resolved: showResolved ? undefined : false,
    limit: 100,
  });

  const resolveMutation = useResolveEventsMutation();

  const events = data?.events ?? [];
  const stats = data?.stats ?? { total: 0, unresolved: 0, by_severity: {}, by_type: {} };

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === events.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(events.filter((e) => !e.resolved).map((e) => e.id)));
    }
  }

  function resolveSelected() {
    if (selectedIds.size === 0) return;
    resolveMutation.mutate(
      { ids: Array.from(selectedIds), resolved: true },
      { onSuccess: () => setSelectedIds(new Set()) },
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-violet-400" />
            <h1 className="text-heading-page text-zinc-100">Data Quality</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Monitor feed health, data gaps, provider fallbacks, and cache performance.
          </p>
        </div>
        <button
          onClick={() => {
            void refetch();
          }}
          className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="py-12 text-center text-sm text-zinc-500">Loading data quality events…</div>
      )}

      {!isLoading && (
        <>
          <StatsGrid stats={stats} />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Filter className="h-3.5 w-3.5" />
              Filters:
            </div>

            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none"
            >
              <option value="">All Types</option>
              {Object.entries(EVENT_TYPE_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none"
            >
              <option value="">All Severities</option>
              {Object.entries(SEVERITY_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
                className="accent-violet-500"
              />
              Show Resolved
            </label>

            {selectedIds.size > 0 && (
              <button
                onClick={resolveSelected}
                disabled={resolveMutation.isPending}
                className="ml-auto flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {resolveMutation.isPending ? 'Resolving…' : `Resolve ${selectedIds.size} selected`}
              </button>
            )}
          </div>

          {/* Events list */}
          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
            {events.length > 0 && (
              <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === events.filter((e) => !e.resolved).length &&
                    events.length > 0
                  }
                  onChange={selectAll}
                  className="accent-violet-500"
                />
                <span className="text-xs text-zinc-500">
                  {events.length} event{events.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {events.length === 0 && (
              <div className="py-16 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/40" />
                <p className="mt-3 text-sm text-zinc-400">No data quality issues</p>
                <p className="text-xs text-zinc-600">
                  Events will appear here when data quality issues are detected.
                </p>
              </div>
            )}

            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                selected={selectedIds.has(event.id)}
                onSelect={toggleSelect}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
