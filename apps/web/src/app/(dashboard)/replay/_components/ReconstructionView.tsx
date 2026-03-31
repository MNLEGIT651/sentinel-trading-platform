import {
  Zap,
  Shield,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  BookOpen,
  Globe,
  Activity,
  Gavel,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  RecommendationReplayData,
  JournalEntryRecord,
} from '@/hooks/queries/use-recommendation-replay-query';
import type { RiskEvaluation, Fill, OperatorAction } from '@sentinel/shared';
import { REGIME_COLORS, GRADE_COLORS } from '../_constants';
import { formatTimestamp, formatCurrency, formatEventType } from '../_helpers';
import { StatusBadge } from './StatusBadge';
import { MetricCard } from './MetricCard';
import { ReconstructionSection } from './ReconstructionSection';
import { CollapsibleJson } from './CollapsibleJson';
import { RecEventTimeline } from './RecEventTimeline';
import { OutcomeAnalysis } from './OutcomeAnalysis';

export function ReconstructionView({
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
