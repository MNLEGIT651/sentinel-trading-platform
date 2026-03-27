'use client';

import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
  TrendingUp,
  TrendingDown,
  XCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRiskPreviewQuery } from '@/hooks/queries/use-risk-preview-query';
import type { PolicyImpact } from '@/hooks/queries/use-risk-preview-query';

// ── Impact row component ────────────────────────────────────────────

function ImpactRow({ impact }: { impact: PolicyImpact }) {
  const delta = impact.projected - impact.current;
  const isIncrease = delta > 0;
  const headroom = impact.limit > 0 ? (impact.projected / impact.limit) * 100 : 0;
  const isNearLimit = headroom > 80;
  const isOverLimit = headroom > 100;

  return (
    <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-foreground">{impact.metric}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">
            {impact.current}
            {impact.unit}
          </span>
          <span className="text-muted-foreground">→</span>
          <span
            className={cn(
              'font-medium',
              isOverLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-foreground',
            )}
          >
            {impact.projected}
            {impact.unit}
          </span>
          {delta !== 0 && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-[10px]',
                isIncrease ? 'text-amber-400' : 'text-emerald-400',
              )}
            >
              {isIncrease ? '↑' : '↓'}
              {Math.abs(delta).toFixed(2)}
              {impact.unit}
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-1.5 h-1 w-full rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-emerald-500',
            )}
            style={{ width: `${Math.min(headroom, 100)}%` }}
          />
        </div>
        <div className="mt-0.5 text-[9px] text-muted-foreground">
          Limit: {impact.limit}
          {impact.unit}
        </div>
      </div>
    </div>
  );
}

// ── Main Approval Dialog ────────────────────────────────────────────

interface ApprovalDialogProps {
  recommendationId: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: string;
  reason?: string | undefined;
  strategyName?: string | undefined;
  signalStrength?: number | null | undefined;
  isApproving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onReject: () => void;
}

export function ApprovalDialog({
  recommendationId,
  ticker,
  side,
  quantity,
  orderType,
  reason,
  strategyName,
  signalStrength,
  isApproving,
  onConfirm,
  onCancel,
  onReject,
}: ApprovalDialogProps) {
  const { data, isLoading, isError } = useRiskPreviewQuery(recommendationId);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  const handleReject = useCallback(() => {
    if (showRejectConfirm) {
      onReject();
    } else {
      setShowRejectConfirm(true);
    }
  }, [showRejectConfirm, onReject]);

  const hasWarnings = data?.impacts.some((i) => {
    const headroom = i.limit > 0 ? (i.projected / i.limit) * 100 : 0;
    return headroom > 80;
  });

  const hasBreaches = data?.impacts.some((i) => {
    const headroom = i.limit > 0 ? (i.projected / i.limit) * 100 : 0;
    return headroom > 100;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg animate-in fade-in zoom-in-95 rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Risk Review</h2>
            <p className="text-[11px] text-muted-foreground">
              Review policy impact before approving
            </p>
          </div>
        </div>

        {/* Trade summary */}
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            {side === 'buy' ? (
              <TrendingUp className="h-4 w-4 text-profit" />
            ) : (
              <TrendingDown className="h-4 w-4 text-loss" />
            )}
            <span className="text-sm font-bold text-foreground">{ticker}</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                side === 'buy' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss',
              )}
            >
              {side.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">
              {quantity} shares @ {orderType}
            </span>
          </div>
          {(strategyName ?? reason) && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {strategyName && (
                <span className="font-mono">
                  {strategyName}
                  {signalStrength != null && ` · ${(signalStrength * 100).toFixed(0)}%`}
                </span>
              )}
              {reason && <p className="mt-0.5">{reason}</p>}
            </div>
          )}
        </div>

        {/* Risk impacts */}
        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading risk assessment...</span>
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Could not load risk data. You can still approve, but proceed with caution.
              </span>
            </div>
          )}

          {data && (
            <>
              {/* Engine connection status */}
              <div className="mb-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {data.portfolio.engine_connected ? (
                  <>
                    <Wifi className="h-3 w-3 text-emerald-400" />
                    Live portfolio data
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-amber-400" />
                    Estimated (engine offline)
                  </>
                )}
              </div>

              {/* Warning banner */}
              {hasBreaches && (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>This trade would exceed one or more risk limits.</span>
                </div>
              )}
              {hasWarnings && !hasBreaches && (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>This trade approaches risk limits.</span>
                </div>
              )}

              {/* Impact rows */}
              <div className="space-y-2">
                {data.impacts.map((impact) => (
                  <ImpactRow key={impact.metric} impact={impact} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <button
            onClick={handleReject}
            disabled={isApproving}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            {showRejectConfirm ? 'Confirm Reject' : 'Reject'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={isApproving}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isApproving}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50',
                hasBreaches
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700',
              )}
            >
              {isApproving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {hasBreaches ? 'Approve Anyway' : 'Approve Trade'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
