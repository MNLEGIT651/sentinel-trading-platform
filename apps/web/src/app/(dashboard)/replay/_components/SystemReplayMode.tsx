'use client';

import { useState, useMemo } from 'react';
import {
  Clock,
  ChevronDown,
  ChevronRight,
  Filter,
  BarChart3,
  Shield,
  BookOpen,
  Database,
  ShoppingCart,
  Bell,
} from 'lucide-react';
import { useReplayQuery } from '@/hooks/queries';
import type { TimelineEventType, TimelineEventSeverity } from '@/hooks/queries';
import { WINDOW_OPTIONS, EVENT_TYPE_CONFIG, SEVERITY_ICONS } from '../_constants';
import { toLocalDatetimeStr, formatTimestamp } from '../_helpers';
import { SummaryCard } from './SummaryCard';
import { PolicyBadge } from './PolicyBadge';

export function SystemReplayMode() {
  const now = new Date();
  const [dateStr, setDateStr] = useState(toLocalDatetimeStr(now));
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TimelineEventType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<TimelineEventSeverity | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useReplayQuery(submitted, windowMinutes);

  const timeline = data?.timeline;
  const filteredTimeline = useMemo(() => {
    if (!timeline) return [];
    return timeline.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      return true;
    });
  }, [timeline, typeFilter, severityFilter]);

  function handleReplay() {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      setSubmitted(d.toISOString());
      setExpandedId(null);
    }
  }

  return (
    <>
      {/* Controls */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Timestamp</label>
            <input
              type="datetime-local"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Window (±)</label>
            <select
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value))}
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleReplay}
            className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Replay
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-400" />
          <span className="ml-3 text-gray-400">Loading system state…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-red-400">{error.message}</p>
        </div>
      )}

      {/* Results */}
      {data && !isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <SummaryCard
              label="Recommendations"
              count={data.summary.counts.recommendations}
              icon={BarChart3}
              color="text-blue-400"
            />
            <SummaryCard
              label="Journal Entries"
              count={data.summary.counts.journal_entries}
              icon={BookOpen}
              color="text-purple-400"
            />
            <SummaryCard
              label="Active Alerts"
              count={data.summary.counts.active_alerts}
              icon={Bell}
              color="text-yellow-400"
            />
            <SummaryCard
              label="Orders"
              count={data.summary.counts.orders}
              icon={ShoppingCart}
              color="text-green-400"
            />
            <SummaryCard
              label="Data Quality"
              count={data.summary.counts.data_quality_events}
              icon={Database}
              color="text-gray-400"
            />
          </div>

          {/* Policy snapshot */}
          {data.summary.trading_policy && (
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-indigo-400" />
                Trading Policy at Snapshot
              </h3>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <PolicyBadge
                  label="Paper Trading"
                  value={data.summary.trading_policy.paper_trading ? 'Yes' : 'No'}
                />
                <PolicyBadge
                  label="Auto Trading"
                  value={data.summary.trading_policy.auto_trading ? 'Yes' : 'No'}
                />
                <PolicyBadge
                  label="Max Position"
                  value={`${data.summary.trading_policy.max_position_pct}%`}
                />
                <PolicyBadge
                  label="Daily Loss Limit"
                  value={`${data.summary.trading_policy.daily_loss_limit_pct}%`}
                />
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TimelineEventType | 'all')}
              className="rounded-md border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-white"
            >
              <option value="all">All Types</option>
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as TimelineEventSeverity | 'all')}
              className="rounded-md border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-white"
            >
              <option value="all">All Severities</option>
              <option value="success">Success</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            <span className="text-xs text-gray-500">
              {filteredTimeline.length} event{filteredTimeline.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            {filteredTimeline.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Clock className="h-10 w-10 mb-3 text-gray-600" />
                <p className="text-sm">No events found in this window</p>
                <p className="text-xs mt-1">Try expanding the time window or adjusting filters</p>
              </div>
            )}

            {filteredTimeline.map((event) => {
              const typeConfig = EVENT_TYPE_CONFIG[event.type];
              const sevConfig = SEVERITY_ICONS[event.severity];
              const TypeIcon = typeConfig.icon;
              const SevIcon = sevConfig.icon;
              const isExpanded = expandedId === event.id;

              return (
                <div
                  key={event.id}
                  className="rounded-lg border border-gray-700 bg-gray-800 transition-colors hover:border-gray-600"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <SevIcon className={`h-4 w-4 flex-shrink-0 ${sevConfig.color}`} />
                    <span
                      className={`flex items-center gap-1 rounded-full bg-gray-700 px-2 py-0.5 text-xs ${typeConfig.color}`}
                    >
                      <TypeIcon className="h-3 w-3" />
                      {typeConfig.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white">{event.title}</span>
                      {event.detail && (
                        <span className="ml-2 text-xs text-gray-400 truncate">{event.detail}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatTimestamp(event.timestamp)}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-700 p-3">
                      <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Prompt before first replay */}
      {!submitted && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Clock className="h-12 w-12 mb-4 text-gray-600" />
          <p className="text-lg font-medium text-gray-400">Select a timestamp to begin replay</p>
          <p className="text-sm mt-1">
            View recommendations, orders, alerts, journal entries, and data quality events at any
            point in time
          </p>
        </div>
      )}
    </>
  );
}
