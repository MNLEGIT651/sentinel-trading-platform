import { Shield, XCircle, TrendingUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecommendationReplayData } from '@/hooks/queries/use-recommendation-replay-query';
import { GRADE_COLORS } from '../_constants';
import { formatCurrency, formatPct } from '../_helpers';
import { ReconstructionSection } from './ReconstructionSection';
import { StatusBadge } from './StatusBadge';

export function OutcomeAnalysis({
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
