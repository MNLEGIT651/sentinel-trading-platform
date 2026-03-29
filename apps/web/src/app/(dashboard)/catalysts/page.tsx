'use client';

import { useState, useMemo } from 'react';
import {
  Calendar,
  Plus,
  TrendingUp,
  DollarSign,
  Landmark,
  BarChart3,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';
import { useCatalystsQuery, useCreateCatalystMutation } from '@/hooks/queries';
import type { CatalystEventType, CatalystImpact, CatalystEvent } from '@/hooks/queries';

// ── Constants ──────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<
  CatalystEventType,
  { label: string; icon: typeof Calendar; color: string }
> = {
  earnings: { label: 'Earnings', icon: DollarSign, color: 'text-green-400' },
  dividend: { label: 'Dividend', icon: DollarSign, color: 'text-emerald-400' },
  split: { label: 'Split', icon: BarChart3, color: 'text-blue-400' },
  ipo: { label: 'IPO', icon: TrendingUp, color: 'text-purple-400' },
  macro: { label: 'Macro', icon: Landmark, color: 'text-yellow-400' },
  fed_meeting: { label: 'Fed Meeting', icon: Landmark, color: 'text-red-400' },
  economic_data: { label: 'Economic Data', icon: BarChart3, color: 'text-cyan-400' },
  options_expiry: { label: 'Options Expiry', icon: Calendar, color: 'text-orange-400' },
  ex_dividend: { label: 'Ex-Dividend', icon: DollarSign, color: 'text-teal-400' },
  conference: { label: 'Conference', icon: Calendar, color: 'text-indigo-400' },
  custom: { label: 'Custom', icon: Calendar, color: 'text-gray-400' },
};

const IMPACT_CONFIG: Record<CatalystImpact, { label: string; color: string; bg: string }> = {
  high: { label: 'High', color: 'text-red-400', bg: 'bg-red-400/10' },
  medium: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  low: { label: 'Low', color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function futureStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ── Page ───────────────────────────────────────────────

export default function CatalystsPage() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(futureStr(30));
  const [typeFilter, setTypeFilter] = useState<CatalystEventType | 'all'>('all');
  const [impactFilter, setImpactFilter] = useState<CatalystImpact | 'all'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useCatalystsQuery({ from, to });

  const events = data?.events;
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => {
      if (typeFilter !== 'all' && e.event_type !== typeFilter) return false;
      if (impactFilter !== 'all' && e.impact !== impactFilter) return false;
      return true;
    });
  }, [events, typeFilter, impactFilter]);

  // Group filtered events by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, CatalystEvent[]> = {};
    for (const event of filteredEvents) {
      const list = groups[event.event_date];
      if (list) {
        list.push(event);
      } else {
        groups[event.event_date] = [event];
      }
    }
    return groups;
  }, [filteredEvents]);

  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-page text-white flex items-center gap-2">
            <Calendar className="h-6 w-6 text-orange-400" />
            Catalyst Overlay
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Earnings, macro events, and market catalysts that provide context for trading decisions
          </p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Event
        </button>
      </div>

      {/* Date Range & Filters */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as CatalystEventType | 'all')}
              className="rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white"
            >
              <option value="all">All Types</option>
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
            <select
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value as CatalystImpact | 'all')}
              className="rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white"
            >
              <option value="all">All Impact</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          {data?.stats && (
            <span className="text-xs text-gray-500">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
              {data.stats.total !== filteredEvents.length && ` of ${data.stats.total}`}
            </span>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {data?.stats && data.stats.total > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {Object.entries(data.stats.byType).map(([type, count]) => {
            const cfg = EVENT_TYPE_CONFIG[type as CatalystEventType];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <div key={type} className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                  <span className="text-xs text-gray-400">{cfg.label}</span>
                </div>
                <p className="mt-1 text-lg font-bold text-white">{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-orange-400" />
          <span className="ml-3 text-gray-400">Loading catalysts…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-red-400">{error.message}</p>
        </div>
      )}

      {/* Calendar Timeline */}
      {!isLoading && !error && (
        <div className="space-y-4">
          {sortedDates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Calendar className="h-10 w-10 mb-3 text-gray-600" />
              <p className="text-sm">No catalyst events in this date range</p>
            </div>
          )}

          {sortedDates.map((date) => {
            const events = groupedByDate[date];
            if (!events) return null;
            const isToday = date === todayStr();

            return (
              <div key={date}>
                {/* Date header */}
                <div className="sticky top-0 z-10 flex items-center gap-2 bg-gray-900/95 backdrop-blur py-2">
                  <div
                    className={`h-2 w-2 rounded-full ${isToday ? 'bg-orange-400' : 'bg-gray-600'}`}
                  />
                  <span
                    className={`text-sm font-medium ${isToday ? 'text-orange-400' : 'text-gray-400'}`}
                  >
                    {formatDate(date)}
                    {isToday && (
                      <span className="ml-2 text-xs bg-orange-400/20 text-orange-300 px-2 py-0.5 rounded">
                        Today
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-600">({events.length})</span>
                </div>

                {/* Events for this date */}
                <div className="space-y-2 ml-4">
                  {events.map((event) => {
                    const typeCfg = EVENT_TYPE_CONFIG[event.event_type];
                    const impactCfg = IMPACT_CONFIG[event.impact];
                    const TypeIcon = typeCfg?.icon || Calendar;
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
                          {/* Impact indicator */}
                          {event.impact === 'high' && (
                            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
                          )}

                          {/* Type badge */}
                          <span
                            className={`flex items-center gap-1 rounded-full bg-gray-700 px-2 py-0.5 text-xs ${typeCfg?.color || 'text-gray-400'}`}
                          >
                            <TypeIcon className="h-3 w-3" />
                            {typeCfg?.label || event.event_type}
                          </span>

                          {/* Ticker */}
                          {event.ticker && (
                            <span className="rounded bg-gray-700 px-2 py-0.5 text-xs font-mono text-white">
                              {event.ticker}
                            </span>
                          )}

                          {/* Title */}
                          <span className="flex-1 text-sm text-white truncate">{event.title}</span>

                          {/* Impact badge */}
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${impactCfg?.color || 'text-gray-400'} ${impactCfg?.bg || ''}`}
                          >
                            {impactCfg?.label || event.impact}
                          </span>

                          {/* Time */}
                          {event.event_time && (
                            <span className="text-xs text-gray-500">
                              {event.event_time.slice(0, 5)}
                            </span>
                          )}

                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="border-t border-gray-700 p-3 space-y-3">
                            {event.description && (
                              <p className="text-sm text-gray-300">{event.description}</p>
                            )}

                            {/* Earnings data */}
                            {event.event_type === 'earnings' && (
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                <EarningsCell label="EPS Est" value={event.eps_estimate} />
                                <EarningsCell label="EPS Act" value={event.eps_actual} />
                                <EarningsCell
                                  label="Rev Est"
                                  value={event.revenue_estimate}
                                  prefix="$"
                                />
                                <EarningsCell
                                  label="Rev Act"
                                  value={event.revenue_actual}
                                  prefix="$"
                                />
                              </div>
                            )}

                            {/* Metadata */}
                            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                              <span>Source: {event.source}</span>
                              {event.sector && <span>Sector: {event.sector}</span>}
                              <span>Added: {new Date(event.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Event Dialog */}
      {showAddDialog && <AddCatalystDialog onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────

function EarningsCell({
  label,
  value,
  prefix,
}: {
  label: string;
  value: number | null;
  prefix?: string | undefined;
}) {
  return (
    <div className="rounded bg-gray-700/50 px-2 py-1 text-xs">
      <span className="text-gray-500">{label}: </span>
      <span className="text-gray-300 font-medium">
        {value != null ? `${prefix || ''}${value.toLocaleString()}` : '—'}
      </span>
    </div>
  );
}

function AddCatalystDialog({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateCatalystMutation();
  const [formData, setFormData] = useState({
    event_type: 'custom' as CatalystEventType,
    title: '',
    event_date: todayStr(),
    event_time: '',
    ticker: '',
    sector: '',
    description: '',
    impact: 'medium' as CatalystImpact,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(
      {
        event_type: formData.event_type,
        title: formData.title,
        event_date: formData.event_date,
        event_time: formData.event_time || undefined,
        ticker: formData.ticker || undefined,
        sector: formData.sector || undefined,
        description: formData.description || undefined,
        impact: formData.impact,
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Add Catalyst Event</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Type *</label>
              <select
                value={formData.event_type}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, event_type: e.target.value as CatalystEventType }))
                }
                className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
              >
                {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Impact</label>
              <select
                value={formData.impact}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, impact: e.target.value as CatalystImpact }))
                }
                className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g., AAPL Q2 Earnings"
              required
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Date *</label>
              <input
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData((p) => ({ ...p, event_date: e.target.value }))}
                required
                className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Time</label>
              <input
                type="time"
                value={formData.event_time}
                onChange={(e) => setFormData((p) => ({ ...p, event_time: e.target.value }))}
                className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Ticker</label>
              <input
                type="text"
                value={formData.ticker}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, ticker: e.target.value.toUpperCase() }))
                }
                placeholder="AAPL"
                className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Sector</label>
              <input
                type="text"
                value={formData.sector}
                onChange={(e) => setFormData((p) => ({ ...p, sector: e.target.value }))}
                placeholder="Technology"
                className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="Additional context about this event..."
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !formData.title || !formData.event_date}
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Saving…' : 'Add Event'}
            </button>
          </div>

          {createMutation.error && (
            <p className="text-xs text-red-400">{createMutation.error.message}</p>
          )}
        </form>
      </div>
    </div>
  );
}
