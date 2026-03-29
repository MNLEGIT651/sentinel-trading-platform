'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  ChevronDown,
  ChevronRight,
  Filter,
  BarChart3,
  Shield,
  BookOpen,
  Database,
  ShoppingCart,
  Bell,
  Search,
  ArrowRight,
  TrendingUp,
  Activity,
  Gavel,
  User,
  Zap,
  Globe,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReplayQuery } from '@/hooks/queries';
import type { TimelineEventType, TimelineEventSeverity } from '@/hooks/queries';
import {
  useRecommendationSearchQuery,
  useRecommendationReplayQuery,
} from '@/hooks/queries/use-recommendation-replay-query';
import type {
  RecommendationSearchFilters,
  RecommendationReplayData,
  JournalEntryRecord,
} from '@/hooks/queries/use-recommendation-replay-query';
import type { RecommendationEvent, RiskEvaluation, Fill, OperatorAction } from '@sentinel/shared';

// ── Constants ──────────────────────────────────────────

type ReplayMode = 'system' | 'recommendation';

const EVENT_TYPE_CONFIG: Record<
  TimelineEventType,
  { label: string; icon: typeof Clock; color: string }
> = {
  recommendation: { label: 'Recommendation', icon: BarChart3, color: 'text-blue-400' },
  journal: { label: 'Journal', icon: BookOpen, color: 'text-purple-400' },
  alert: { label: 'Alert', icon: Bell, color: 'text-yellow-400' },
  order: { label: 'Order', icon: ShoppingCart, color: 'text-green-400' },
  data_quality: { label: 'Data Quality', icon: Database, color: 'text-gray-400' },
};

const SEVERITY_ICONS: Record<TimelineEventSeverity, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: 'text-blue-400' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400' },
  error: { icon: XCircle, color: 'text-red-400' },
  success: { icon: CheckCircle2, color: 'text-green-400' },
};

const WINDOW_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
];

const REC_STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Filled', value: 'filled' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Risk Blocked', value: 'risk_blocked' },
];

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-blue-500/10 text-blue-400',
  pending: 'bg-blue-500/10 text-blue-400',
  pending_approval: 'bg-blue-500/10 text-blue-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  filled: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
  risk_blocked: 'bg-red-500/10 text-red-400',
  risk_checked: 'bg-zinc-500/10 text-zinc-400',
  failed: 'bg-red-500/10 text-red-400',
  cancelled: 'bg-red-500/10 text-red-400',
  submitted: 'bg-amber-500/10 text-amber-400',
  partially_filled: 'bg-amber-500/10 text-amber-400',
  reviewed: 'bg-zinc-500/10 text-zinc-400',
};

const EVENT_CATEGORY_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  created: { bg: 'bg-blue-500/5', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  risk_checked: { bg: 'bg-zinc-500/5', border: 'border-zinc-500/30', dot: 'bg-zinc-400' },
  risk_blocked: { bg: 'bg-red-500/5', border: 'border-red-500/30', dot: 'bg-red-400' },
  pending_approval: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  approved: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  rejected: { bg: 'bg-red-500/5', border: 'border-red-500/30', dot: 'bg-red-400' },
  submitted: { bg: 'bg-indigo-500/5', border: 'border-indigo-500/30', dot: 'bg-indigo-400' },
  partially_filled: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  filled: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  cancelled: { bg: 'bg-zinc-500/5', border: 'border-zinc-500/30', dot: 'bg-zinc-400' },
  failed: { bg: 'bg-red-500/5', border: 'border-red-500/30', dot: 'bg-red-400' },
  reviewed: { bg: 'bg-violet-500/5', border: 'border-violet-500/30', dot: 'bg-violet-400' },
};

const EVENT_ICONS: Record<string, typeof Clock> = {
  created: Zap,
  risk_checked: Shield,
  risk_blocked: Shield,
  pending_approval: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  submitted: ArrowRight,
  partially_filled: Activity,
  filled: CheckCircle2,
  cancelled: XCircle,
  failed: AlertTriangle,
  reviewed: FileText,
};

const GRADE_COLORS: Record<string, string> = {
  excellent: 'text-emerald-400',
  good: 'text-green-400',
  neutral: 'text-zinc-400',
  bad: 'text-orange-400',
  terrible: 'text-red-400',
};

const REGIME_COLORS: Record<string, string> = {
  bull: 'text-emerald-400',
  bear: 'text-red-400',
  sideways: 'text-zinc-400',
  volatile: 'text-amber-400',
  crisis: 'text-red-500',
};

// ── Helpers ────────────────────────────────────────────

function toLocalDatetimeStr(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateStr(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${Number(value).toFixed(2)}`;
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(2)}%`;
}

function formatEventType(t: string): string {
  return t.replace(/_/g, ' ');
}

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-zinc-500/10 text-zinc-400';
}

// ── Page ───────────────────────────────────────────────

export default function ReplayPage() {
  const [mode, setMode] = useState<ReplayMode>('recommendation');

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock className="h-6 w-6 text-indigo-400" />
          Replay &amp; Review
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Reconstruct what happened for any recommendation or replay system state at a point in time
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-800 p-1 w-fit">
        <button
          onClick={() => setMode('recommendation')}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            mode === 'recommendation'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          <Search className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Recommendation Replay
        </button>
        <button
          onClick={() => setMode('system')}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            mode === 'system' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white',
          )}
        >
          <Clock className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          System Replay
        </button>
      </div>

      {mode === 'recommendation' ? <RecommendationReplayMode /> : <SystemReplayMode />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  RECOMMENDATION REPLAY MODE
// ══════════════════════════════════════════════════════════

function RecommendationReplayMode() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [ticker, setTicker] = useState('');
  const [recId, setRecId] = useState('');
  const [fromDate, setFromDate] = useState(toDateStr(thirtyDaysAgo));
  const [toDate, setToDate] = useState(toDateStr(now));
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);

  const filters: RecommendationSearchFilters = useMemo(
    () => ({
      ...(recId ? { id: recId } : {}),
      ...(ticker ? { ticker } : {}),
      from: fromDate ? new Date(fromDate).toISOString() : undefined,
      to: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      limit: 50,
    }),
    [recId, ticker, fromDate, toDate, statusFilter],
  );

  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
  } = useRecommendationSearchQuery(filters, searchSubmitted);

  const {
    data: replayData,
    isLoading: replayLoading,
    error: replayError,
  } = useRecommendationReplayQuery(selectedRecId);

  const handleSearch = useCallback(() => {
    setSearchSubmitted(true);
    setSelectedRecId(null);
  }, []);

  const handleSelectRec = useCallback((id: string) => {
    setSelectedRecId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedRecId(null);
  }, []);

  // If a recommendation is selected, show the reconstruction
  if (selectedRecId && replayData) {
    return <ReconstructionView data={replayData} onBack={handleBack} />;
  }

  return (
    <>
      {/* Search Controls */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[120px] flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Recommendation ID
            </label>
            <input
              type="text"
              value={recId}
              onChange={(e) => setRecId(e.target.value)}
              placeholder="UUID..."
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            >
              {REC_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            <Search className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            Search
          </button>
        </div>
      </div>

      {/* Loading */}
      {(searchLoading || replayLoading) && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-400" />
          <span className="ml-3 text-gray-400">
            {replayLoading ? 'Loading reconstruction…' : 'Searching…'}
          </span>
        </div>
      )}

      {/* Error */}
      {(searchError || replayError) && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-red-400">
            {(searchError || replayError)?.message || 'An error occurred'}
          </p>
        </div>
      )}

      {/* Search Results */}
      {searchData && !searchLoading && !selectedRecId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {searchData.total} recommendation{searchData.total !== 1 ? 's' : ''} found
            </span>
          </div>

          {searchData.recommendations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Search className="h-10 w-10 mb-3 text-gray-600" />
              <p className="text-sm">No recommendations match your criteria</p>
            </div>
          )}

          {searchData.recommendations.map((rec) => (
            <button
              key={rec.id}
              onClick={() => handleSelectRec(rec.id)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-left transition-colors hover:border-indigo-500/50 hover:bg-gray-750"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 min-w-[120px]">
                  <span className="text-sm font-semibold text-white">{rec.ticker}</span>
                  <StatusBadge status={rec.side} />
                </div>
                <StatusBadge status={rec.status} />
                {rec.strategy_name && (
                  <span className="text-xs text-gray-500">{rec.strategy_name}</span>
                )}
                {rec.signal_strength != null && (
                  <span className="text-xs text-gray-500 font-mono">
                    str: {(Number(rec.signal_strength) * 100).toFixed(0)}%
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-500 flex-shrink-0">
                  {formatTimestamp(rec.created_at)}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
              </div>
              {rec.reason && <p className="mt-1 text-xs text-gray-400 truncate">{rec.reason}</p>}
            </button>
          ))}
        </div>
      )}

      {/* Prompt before first search */}
      {!searchSubmitted && !searchLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Search className="h-12 w-12 mb-4 text-gray-600" />
          <p className="text-lg font-medium text-gray-400">Search for a recommendation to replay</p>
          <p className="text-sm mt-1">Find by ticker, date range, or paste a recommendation ID</p>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  FULL RECONSTRUCTION VIEW
// ══════════════════════════════════════════════════════════

function ReconstructionView({
  data,
  onBack,
}: {
  data: RecommendationReplayData;
  onBack: () => void;
}) {
  const {
    recommendation: rec,
    events,
    riskEvaluations,
    order,
    fills,
    operatorActions,
    journalEntries,
    marketRegime,
    outcome,
  } = data;

  return (
    <div className="space-y-4">
      {/* Back + Header */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
      >
        ← Back to search
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-white">{rec.ticker}</h2>
        <StatusBadge status={rec.side} />
        <StatusBadge status={rec.status} />
        {rec.strategy_name && <span className="text-sm text-gray-400">{rec.strategy_name}</span>}
        <span className="text-xs text-gray-500">{formatTimestamp(rec.created_at)}</span>
      </div>

      {/* Summary cards row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <MetricCard label="Quantity" value={String(Number(rec.quantity))} />
        <MetricCard label="Order Type" value={rec.order_type} />
        <MetricCard
          label="Signal Strength"
          value={
            rec.signal_strength != null ? `${(Number(rec.signal_strength) * 100).toFixed(0)}%` : '—'
          }
        />
        <MetricCard
          label="Limit Price"
          value={rec.limit_price != null ? formatCurrency(rec.limit_price) : '—'}
        />
        <MetricCard label="Events" value={String(events.length)} />
        <MetricCard label="Risk Checks" value={String(riskEvaluations.length)} />
      </div>

      {/* Reason */}
      {rec.reason && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
          <span className="text-xs font-medium text-gray-400">Agent Reasoning</span>
          <p className="mt-1 text-sm text-gray-200">{rec.reason}</p>
        </div>
      )}

      {/* Signal Source Section */}
      <ReconstructionSection title="Signal Source" icon={Zap} iconColor="text-blue-400">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <span className="text-xs text-gray-500">Strategy</span>
            <p className="text-gray-200">{rec.strategy_name || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Strength</span>
            <p className="font-mono text-gray-200">
              {rec.signal_strength != null ? Number(rec.signal_strength).toFixed(4) : '—'}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Direction</span>
            <p className="text-gray-200">{rec.side?.toUpperCase()}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Triggered At</span>
            <p className="text-gray-200">{formatTimestamp(rec.created_at)}</p>
          </div>
        </div>
        {rec.metadata && Object.keys(rec.metadata).length > 0 && (
          <CollapsibleJson label="Signal Metadata" data={rec.metadata} />
        )}
      </ReconstructionSection>

      {/* Risk Evaluation Section */}
      {riskEvaluations.length > 0 && (
        <ReconstructionSection title="Risk Evaluation" icon={Shield} iconColor="text-amber-400">
          {riskEvaluations.map((ev: RiskEvaluation) => (
            <div
              key={ev.id}
              className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <StatusBadge status={ev.allowed ? 'approved' : 'risk_blocked'}>
                  <Shield className="mr-1 h-3 w-3" />
                  {ev.allowed ? 'Passed' : 'Blocked'}
                </StatusBadge>
                <span className="text-xs text-gray-500">{formatTimestamp(ev.evaluated_at)}</span>
              </div>
              {ev.reason && <p className="text-sm text-gray-300">{ev.reason}</p>}
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                {ev.policy_version && (
                  <div>
                    <span className="text-gray-500">Policy</span>
                    <p className="text-gray-300">{ev.policy_version}</p>
                  </div>
                )}
                {ev.original_quantity != null && (
                  <div>
                    <span className="text-gray-500">Original Qty</span>
                    <p className="font-mono text-gray-300">{ev.original_quantity}</p>
                  </div>
                )}
                {ev.adjusted_quantity != null && (
                  <div>
                    <span className="text-gray-500">Adjusted Qty</span>
                    <p className="font-mono text-gray-300">{ev.adjusted_quantity}</p>
                  </div>
                )}
              </div>
              {/* Risk checks */}
              {Array.isArray(ev.checks_performed) && ev.checks_performed.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-gray-500">Checks Performed</span>
                  <div className="space-y-1">
                    {ev.checks_performed.map((check, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center justify-between rounded px-2 py-1 text-xs',
                          check.passed ? 'bg-emerald-500/5' : 'bg-red-500/5',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {check.passed ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-400" />
                          )}
                          <span className={check.passed ? 'text-emerald-300' : 'text-red-300'}>
                            {check.name ?? `check-${i + 1}`}
                          </span>
                        </div>
                        {check.message && <span className="text-gray-500">{check.message}</span>}
                        {check.limit != null && check.actual != null && (
                          <span className="font-mono text-gray-500">
                            {check.actual} / {check.limit}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </ReconstructionSection>
      )}

      {/* Approval Path Section */}
      {operatorActions.length > 0 && (
        <ReconstructionSection title="Approval Path" icon={Gavel} iconColor="text-violet-400">
          <div className="space-y-2">
            {operatorActions.map((action: OperatorAction) => (
              <div key={action.id} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5">
                  <User className="h-4 w-4 text-violet-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-200 font-medium">
                      {formatEventType(action.action_type)}
                    </span>
                    <span className="text-xs text-gray-500">by {action.operator_id}</span>
                    <span className="text-xs text-gray-600">
                      {formatTimestamp(action.created_at)}
                    </span>
                  </div>
                  {action.reason && <p className="text-xs text-gray-400 mt-0.5">{action.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </ReconstructionSection>
      )}

      {/* Execution Section */}
      {order && (
        <ReconstructionSection title="Execution" icon={ShoppingCart} iconColor="text-green-400">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <span className="text-xs text-gray-500">Order Status</span>
              <p>
                <StatusBadge status={order.status} />
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Side / Type</span>
              <p className="text-gray-200">
                {order.side} · {order.order_type}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Qty (filled / total)</span>
              <p className="font-mono text-gray-200">
                {order.filled_quantity} / {order.quantity}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Avg Fill Price</span>
              <p className="font-mono text-gray-200">{formatCurrency(order.filled_avg_price)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Broker Order ID</span>
              <p className="font-mono text-xs text-gray-300 break-all">
                {order.broker_order_id ?? '—'}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Submitted</span>
              <p className="text-xs text-gray-300">{formatTimestamp(order.submitted_at)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Filled At</span>
              <p className="text-xs text-gray-300">
                {order.filled_at ? formatTimestamp(order.filled_at) : '—'}
              </p>
            </div>
            {outcome.total_slippage != null && (
              <div>
                <span className="text-xs text-gray-500">Total Slippage</span>
                <p className="font-mono text-gray-300">
                  {Number(outcome.total_slippage).toFixed(4)}
                </p>
              </div>
            )}
          </div>

          {/* Fills table */}
          {fills.length > 0 && (
            <div className="mt-3">
              <span className="text-xs font-medium text-gray-500">Fills ({fills.length})</span>
              <div className="overflow-x-auto mt-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700 text-left text-gray-500">
                      <th className="pb-1.5 pr-4 font-medium">Time</th>
                      <th className="pb-1.5 pr-4 font-medium">Price</th>
                      <th className="pb-1.5 pr-4 font-medium">Qty</th>
                      <th className="pb-1.5 pr-4 font-medium">Commission</th>
                      <th className="pb-1.5 pr-4 font-medium">Slippage</th>
                      <th className="pb-1.5 font-medium">Venue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fills.map((fill: Fill) => (
                      <tr key={fill.id} className="border-b border-gray-800">
                        <td className="py-1.5 pr-4 text-gray-400">
                          {formatTimestamp(fill.fill_ts)}
                        </td>
                        <td className="py-1.5 pr-4 font-mono text-gray-200">
                          {formatCurrency(fill.fill_price)}
                        </td>
                        <td className="py-1.5 pr-4 font-mono text-gray-200">{fill.fill_qty}</td>
                        <td className="py-1.5 pr-4 font-mono text-gray-200">
                          {formatCurrency(fill.commission)}
                        </td>
                        <td className="py-1.5 pr-4 font-mono text-gray-200">
                          {fill.slippage != null ? Number(fill.slippage).toFixed(4) : '—'}
                        </td>
                        <td className="py-1.5 text-gray-200">{fill.venue ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ReconstructionSection>
      )}

      {/* Market Context Section */}
      {marketRegime && (
        <ReconstructionSection title="Market Context" icon={Globe} iconColor="text-cyan-400">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <span className="text-xs text-gray-500">Regime</span>
              <p
                className={cn(
                  'font-medium capitalize',
                  REGIME_COLORS[marketRegime.regime] || 'text-gray-200',
                )}
              >
                {marketRegime.regime}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Confidence</span>
              <p className="font-mono text-gray-200">
                {(Number(marketRegime.confidence) * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Source</span>
              <p className="text-gray-200">{marketRegime.source}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Detected</span>
              <p className="text-xs text-gray-300">{formatTimestamp(marketRegime.detected_at)}</p>
            </div>
          </div>
          {marketRegime.notes && <p className="text-xs text-gray-400 mt-2">{marketRegime.notes}</p>}
          {marketRegime.indicators && Object.keys(marketRegime.indicators).length > 0 && (
            <CollapsibleJson label="Indicators" data={marketRegime.indicators} />
          )}
        </ReconstructionSection>
      )}

      {/* Decision Journal Section */}
      {journalEntries.length > 0 && (
        <ReconstructionSection title="Decision Journal" icon={BookOpen} iconColor="text-purple-400">
          <div className="space-y-2">
            {journalEntries.map((entry: JournalEntryRecord) => (
              <div
                key={entry.id}
                className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <StatusBadge status={entry.event_type}>
                    {formatEventType(entry.event_type)}
                  </StatusBadge>
                  {entry.agent_name && (
                    <span className="text-xs text-gray-500">{entry.agent_name}</span>
                  )}
                  <span className="text-xs text-gray-600 ml-auto">
                    {formatTimestamp(entry.created_at)}
                  </span>
                </div>
                {entry.reasoning && <p className="text-sm text-gray-300">{entry.reasoning}</p>}
                {entry.user_notes && (
                  <p className="text-sm text-gray-400 italic">&ldquo;{entry.user_notes}&rdquo;</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs">
                  {entry.market_regime && (
                    <span className="text-gray-500">
                      Regime:{' '}
                      <span className={REGIME_COLORS[entry.market_regime] || 'text-gray-300'}>
                        {entry.market_regime}
                      </span>
                    </span>
                  )}
                  {entry.vix_at_time != null && (
                    <span className="text-gray-500">
                      VIX:{' '}
                      <span className="font-mono text-gray-300">
                        {Number(entry.vix_at_time).toFixed(1)}
                      </span>
                    </span>
                  )}
                  {entry.sector && (
                    <span className="text-gray-500">
                      Sector: <span className="text-gray-300">{entry.sector}</span>
                    </span>
                  )}
                  {entry.user_grade && (
                    <span className="text-gray-500">
                      Grade:{' '}
                      <span
                        className={cn(
                          'font-medium capitalize',
                          GRADE_COLORS[entry.user_grade] || 'text-gray-300',
                        )}
                      >
                        {entry.user_grade}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ReconstructionSection>
      )}

      {/* Event Timeline (color-coded) */}
      <ReconstructionSection title="Event Timeline" icon={Activity} iconColor="text-indigo-400">
        <RecEventTimeline events={events} />
      </ReconstructionSection>

      {/* Outcome Analysis */}
      <OutcomeAnalysis outcome={outcome} rec={rec} />
    </div>
  );
}

// ── Color-coded Event Timeline ─────────────────────────

function RecEventTimeline({ events }: { events: RecommendationEvent[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No lifecycle events recorded.</p>;
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-700" />

      <div className="space-y-0">
        {events.map((ev, idx) => {
          const catLookup = EVENT_CATEGORY_COLORS[ev.event_type];
          const cat = catLookup ?? {
            bg: 'bg-blue-500/5',
            border: 'border-blue-500/30',
            dot: 'bg-blue-400',
          };
          const IconLookup = EVENT_ICONS[ev.event_type];
          const Icon = IconLookup ?? Clock;
          const isExpanded = expandedId === ev.id;
          const isFirst = idx === 0;
          const isLast = idx === events.length - 1;

          return (
            <div key={ev.id} className="relative flex items-start gap-3 pl-0">
              {/* Timeline dot */}
              <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center">
                <div className={cn('h-3 w-3 rounded-full ring-2 ring-gray-800', cat.dot)} />
              </div>

              {/* Event card */}
              <div
                className={cn(
                  'flex-1 rounded-lg border p-3 transition-colors cursor-pointer',
                  cat.bg,
                  cat.border,
                  isFirst && 'mt-0',
                  isLast && 'mb-0',
                )}
                onClick={() => setExpandedId(isExpanded ? null : ev.id)}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-3.5 w-3.5', cat.dot.replace('bg-', 'text-'))} />
                  <span className="text-sm font-medium text-gray-200 capitalize">
                    {formatEventType(ev.event_type)}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {ev.actor_type}
                    {ev.actor_id ? ` · ${ev.actor_id}` : ''}
                  </span>
                  <span className="ml-auto text-xs text-gray-500 flex-shrink-0">
                    {formatTimestamp(ev.event_ts)}
                  </span>
                  {Object.keys(ev.payload || {}).length > 0 &&
                    (isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                    ))}
                </div>

                {/* Inline payload summary */}
                {!isExpanded && ev.payload && Object.keys(ev.payload).length > 0 && (
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {Object.entries(ev.payload)
                      .slice(0, 3)
                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? '...' : String(v)}`)
                      .join(' · ')}
                  </p>
                )}

                {/* Expanded payload */}
                {isExpanded && ev.payload && Object.keys(ev.payload).length > 0 && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-900/50 p-2 text-xs text-gray-400">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Outcome Analysis ───────────────────────────────────

function OutcomeAnalysis({
  outcome,
  rec,
}: {
  outcome: RecommendationReplayData['outcome'];
  rec: RecommendationReplayData['recommendation'];
}) {
  const isFilled = outcome.status === 'filled';
  const isBlocked = outcome.status === 'risk_blocked' || outcome.status === 'rejected';

  return (
    <ReconstructionSection
      title="Outcome Analysis"
      icon={isFilled ? TrendingUp : isBlocked ? XCircle : Activity}
      iconColor={
        isFilled
          ? outcome.pnl != null && outcome.pnl >= 0
            ? 'text-emerald-400'
            : 'text-red-400'
          : isBlocked
            ? 'text-amber-400'
            : 'text-gray-400'
      }
    >
      {isFilled && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
              <span className="text-xs text-gray-500">P&amp;L</span>
              <p
                className={cn(
                  'text-lg font-bold font-mono',
                  outcome.pnl != null && outcome.pnl >= 0 ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {outcome.pnl != null ? formatCurrency(outcome.pnl) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
              <span className="text-xs text-gray-500">Return</span>
              <p
                className={cn(
                  'text-lg font-bold font-mono',
                  outcome.return_pct != null && outcome.return_pct >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400',
                )}
              >
                {formatPct(outcome.return_pct)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
              <span className="text-xs text-gray-500">Hold Time</span>
              <p className="text-lg font-bold text-gray-200">
                {outcome.hold_minutes != null
                  ? outcome.hold_minutes >= 60
                    ? `${(outcome.hold_minutes / 60).toFixed(1)}h`
                    : `${outcome.hold_minutes}m`
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
              <span className="text-xs text-gray-500">Grade</span>
              <p
                className={cn(
                  'text-lg font-bold capitalize',
                  outcome.grade ? GRADE_COLORS[outcome.grade] || 'text-gray-200' : 'text-gray-500',
                )}
              >
                {outcome.grade || 'Ungraded'}
              </p>
            </div>
          </div>
          {outcome.avg_fill_price != null && (
            <div className="flex gap-4 text-xs text-gray-500">
              <span>
                Avg fill price:{' '}
                <span className="font-mono text-gray-300">
                  {formatCurrency(outcome.avg_fill_price)}
                </span>
              </span>
              {outcome.fill_count != null && (
                <span>
                  Fills: <span className="text-gray-300">{outcome.fill_count}</span>
                </span>
              )}
              {outcome.total_slippage != null && (
                <span>
                  Total slippage:{' '}
                  <span className="font-mono text-gray-300">
                    {Number(outcome.total_slippage).toFixed(4)}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {isBlocked && (
        <div className="space-y-2">
          <div className="rounded-lg border border-amber-800/30 bg-amber-900/10 p-3">
            <div className="flex items-center gap-2">
              {outcome.status === 'risk_blocked' ? (
                <Shield className="h-4 w-4 text-amber-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm font-medium text-amber-300">
                {outcome.status === 'risk_blocked'
                  ? 'Blocked by Risk Policy'
                  : 'Rejected by Operator'}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              This {rec.side} {rec.ticker} recommendation for {Number(rec.quantity)} shares was{' '}
              {outcome.status === 'risk_blocked' ? 'blocked by risk checks' : 'rejected'}.
            </p>
          </div>
        </div>
      )}

      {!isFilled && !isBlocked && (
        <div className="text-sm text-gray-500">
          <p>
            Status: <StatusBadge status={outcome.status} /> — Outcome data will appear once the
            recommendation reaches a terminal state.
          </p>
        </div>
      )}
    </ReconstructionSection>
  );
}

// ══════════════════════════════════════════════════════════
//  SYSTEM REPLAY MODE (existing functionality)
// ══════════════════════════════════════════════════════════

function SystemReplayMode() {
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

// ══════════════════════════════════════════════════════════
//  SHARED SUB-COMPONENTS
// ══════════════════════════════════════════════════════════

function StatusBadge({
  status,
  children,
  className: extraClass,
}: {
  status: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusColor(status),
        extraClass,
      )}
    >
      {children ?? formatEventType(status)}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <span className="text-xs text-gray-500">{label}</span>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ReconstructionSection({
  title,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  icon: typeof Clock;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function CollapsibleJson({ label, data }: { label: string; data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-900/50 p-2 text-xs text-gray-400">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: typeof Clock;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-white">{count}</p>
    </div>
  );
}

function PolicyBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-gray-700/50 px-2 py-1">
      <span className="text-gray-500">{label}: </span>
      <span className="text-gray-300 font-medium">{value}</span>
    </div>
  );
}
