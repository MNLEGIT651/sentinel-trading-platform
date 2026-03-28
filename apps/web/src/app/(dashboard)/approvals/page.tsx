'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TradeRecommendation } from '@/lib/agents-client';
import { useRecommendationsQuery } from '@/hooks/queries/use-recommendations-query';
import { useApproveRecommendationMutation } from '@/hooks/queries/use-approve-recommendation-mutation';
import { useRejectRecommendationMutation } from '@/hooks/queries/use-reject-recommendation-mutation';
import { ApprovalDialog } from '@/components/agents/approval-dialog';

// ── Types ──────────────────────────────────────────────────────────

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'filled' | 'risk_blocked' | 'all';
type SideFilter = 'all' | 'buy' | 'sell';
type SortOption = 'newest' | 'strength' | 'fit';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'filled', label: 'Filled' },
  { value: 'risk_blocked', label: 'Risk Blocked' },
  { value: 'all', label: 'All' },
];

// ── Helpers ────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function signalColor(strength: number): string {
  if (strength > 0.7) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
  if (strength >= 0.5) return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
  return 'text-red-400 border-red-500/20 bg-red-500/10';
}

function statusBadge(status: TradeRecommendation['status']) {
  switch (status) {
    case 'pending':
      return { className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'Pending' };
    case 'approved':
      return {
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        label: 'Approved',
      };
    case 'rejected':
      return { className: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Rejected' };
    case 'filled':
      return { className: 'bg-blue-500/15 text-blue-400 border-blue-500/30', label: 'Filled' };
    case 'risk_blocked':
      return {
        className: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        label: 'Risk Blocked',
      };
    default:
      return { className: 'bg-muted text-muted-foreground border-border', label: status };
  }
}

// ── Skeleton placeholder ───────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border/50 bg-muted/30 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-10 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="h-3 w-48 rounded bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-32 rounded bg-muted" />
          <div className="h-7 w-20 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────

interface StatsBarProps {
  recommendations: TradeRecommendation[];
}

function StatsBar({ recommendations }: StatsBarProps) {
  const stats = useMemo(() => {
    const total = recommendations.length;
    const buyCount = recommendations.filter((r) => r.side === 'buy').length;
    const sellCount = recommendations.filter((r) => r.side === 'sell').length;
    const strengths = recommendations
      .map((r) => r.signal_strength)
      .filter((s): s is number => s != null);
    const avgStrength =
      strengths.length > 0 ? strengths.reduce((a, b) => a + b, 0) / strengths.length : 0;

    return { total, buyCount, sellCount, avgStrength };
  }, [recommendations]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="text-[11px] text-muted-foreground">Total</div>
        <div className="mt-1 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <span className="text-xl font-bold text-foreground">{stats.total}</span>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="text-[11px] text-muted-foreground">Avg Signal</div>
        <div className="mt-1 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-blue-400" />
          <span className="text-xl font-bold text-foreground">
            {stats.avgStrength > 0 ? `${(stats.avgStrength * 100).toFixed(0)}%` : '—'}
          </span>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="text-[11px] text-muted-foreground">Buy</div>
        <div className="mt-1 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-profit" />
          <span className="text-xl font-bold text-foreground">{stats.buyCount}</span>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="text-[11px] text-muted-foreground">Sell</div>
        <div className="mt-1 flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-loss" />
          <span className="text-xl font-bold text-foreground">{stats.sellCount}</span>
        </div>
      </div>
    </div>
  );
}

// ── Reject dialog ──────────────────────────────────────────────────

interface RejectDialogProps {
  rec: TradeRecommendation;
  isRejecting: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

function RejectDialog({ rec, isRejecting, onConfirm, onCancel }: RejectDialogProps) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md animate-in fade-in zoom-in-95 rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <XCircle className="h-5 w-5 text-red-400" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Reject Recommendation</h2>
            <p className="text-[11px] text-muted-foreground">
              {rec.ticker} · {rec.side.toUpperCase()} {rec.quantity} shares
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <label
            htmlFor="reject-reason"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Rejection reason
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Provide a reason for rejecting this recommendation..."
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onCancel}
            disabled={isRejecting}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isRejecting}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isRejecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const { data: recommendations, isLoading, isError } = useRecommendationsQuery(statusFilter);
  const approveMutation = useApproveRecommendationMutation();
  const rejectMutation = useRejectRecommendationMutation();

  const [reviewingRec, setReviewingRec] = useState<TradeRecommendation | null>(null);
  const [rejectingRec, setRejectingRec] = useState<TradeRecommendation | null>(null);
  const [tickerSearch, setTickerSearch] = useState('');
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const strategies = useMemo(() => {
    if (!recommendations) return [];
    const names = new Set<string>();
    for (const r of recommendations) {
      if (r.strategy_name) names.add(r.strategy_name);
    }
    return Array.from(names).sort();
  }, [recommendations]);

  const filtered = useMemo(() => {
    if (!recommendations) return [];
    let list = [...recommendations];

    if (tickerSearch.trim()) {
      const q = tickerSearch.trim().toUpperCase();
      list = list.filter((r) => r.ticker.toUpperCase().includes(q));
    }
    if (sideFilter !== 'all') {
      list = list.filter((r) => r.side === sideFilter);
    }
    if (strategyFilter !== 'all') {
      list = list.filter((r) => r.strategy_name === strategyFilter);
    }

    list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'strength') {
        return (b.signal_strength ?? -1) - (a.signal_strength ?? -1);
      }
      // sort by portfolio fit score (from metadata)
      const aFit = a.metadata?.portfolio_fit_score ?? -1;
      const bFit = b.metadata?.portfolio_fit_score ?? -1;
      return bFit - aFit;
    });

    return list;
  }, [recommendations, tickerSearch, sideFilter, strategyFilter, sortBy]);

  const handleReject = useCallback(
    (id: string, reason: string) => {
      rejectMutation.mutate(reason ? { id, reason } : { id });
      setRejectingRec(null);
    },
    [rejectMutation],
  );

  const isPending = statusFilter === 'pending';

  // ── Loading state ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Approval Queue</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="mt-2 h-6 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Approval Queue</h1>
        </div>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-center gap-3 py-6">
            <XCircle className="h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-400">Failed to load recommendations</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Make sure the agents service is running and try again.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allRecs = recommendations ?? [];

  // ── Rendered page ──────────────────────────────────────────────

  return (
    <>
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Approval Queue</h1>
            {allRecs.length > 0 && isPending && (
              <Badge className="border bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                {allRecs.length} awaiting review
              </Badge>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <StatsBar recommendations={allRecs} />

        {/* Filters */}
        <Card className="border-border bg-card">
          <CardContent className="flex flex-wrap items-center gap-3 py-3">
            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />

            {/* Status filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Ticker search */}
            <div className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={tickerSearch}
                onChange={(e) => setTickerSearch(e.target.value)}
                placeholder="Search ticker..."
                className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Side filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Side:</span>
              {(['all', 'buy', 'sell'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSideFilter(s)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    sideFilter === s
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {s === 'all' ? 'All' : s.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Strategy filter */}
            {strategies.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Strategy:</span>
                <select
                  value={strategyFilter}
                  onChange={(e) => setStrategyFilter(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All</option>
                  {strategies.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Sort:</span>
              {(
                [
                  { key: 'newest', label: 'Newest' },
                  { key: 'strength', label: 'Signal' },
                  { key: 'fit', label: 'Fit Score' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    sortBy === opt.key
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Empty state */}
        {filtered.length === 0 && (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="mb-3 h-10 w-10 text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">
                {isPending ? 'All caught up! No pending approvals.' : 'No recommendations found.'}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {allRecs.length > 0
                  ? 'No recommendations match the current filters.'
                  : isPending
                    ? 'New recommendations will appear here when agents generate them.'
                    : 'Try adjusting your filters.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recommendation cards */}
        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((rec) => {
              const isApproving = approveMutation.isPending && approveMutation.variables === rec.id;
              const isRejecting =
                rejectMutation.isPending && rejectMutation.variables?.id === rec.id;
              const isBusy = isApproving || isRejecting;
              const fitScore = rec.metadata?.portfolio_fit_score;
              const riskNote = rec.metadata?.risk_note;
              const sBadge = statusBadge(rec.status);

              return (
                <Card key={rec.id} className="border-border bg-card">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: recommendation details */}
                      <div className="flex min-w-0 items-start gap-3">
                        {rec.side === 'buy' ? (
                          <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-profit" />
                        ) : (
                          <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-loss" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{rec.ticker}</span>
                            <Badge
                              className={cn(
                                'border text-[9px]',
                                rec.side === 'buy'
                                  ? 'bg-profit/10 text-profit border-profit/20'
                                  : 'bg-loss/10 text-loss border-loss/20',
                              )}
                            >
                              {rec.side.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {rec.quantity} shares · {rec.order_type}
                              {rec.limit_price != null && ` @ $${rec.limit_price}`}
                            </span>
                            {/* Status badge */}
                            <Badge className={cn('border text-[9px]', sBadge.className)}>
                              {sBadge.label}
                            </Badge>
                          </div>

                          {/* Signal strength with color coding + portfolio fit */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {rec.signal_strength != null && (
                              <Badge
                                className={cn(
                                  'border text-[9px]',
                                  signalColor(rec.signal_strength),
                                )}
                              >
                                Signal: {(rec.signal_strength * 100).toFixed(0)}%
                              </Badge>
                            )}
                            {fitScore != null && (
                              <Badge className="border border-purple-500/20 bg-purple-500/10 text-[9px] text-purple-400">
                                Fit: {(fitScore * 100).toFixed(0)}%
                              </Badge>
                            )}
                          </div>

                          {rec.strategy_name && (
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {rec.strategy_name}
                            </div>
                          )}

                          {riskNote && (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-amber-400/80">
                              ⚠ {riskNote}
                            </p>
                          )}

                          {rec.reason && (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                              {rec.reason}
                            </p>
                          )}

                          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span
                              className="flex items-center gap-1"
                              title={new Date(rec.created_at).toLocaleString()}
                            >
                              <Clock className="h-3 w-3" />
                              {relativeTime(rec.created_at)}
                            </span>
                            <Link
                              href={`/recommendations/${rec.id}`}
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Details
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* Right: action buttons (only for pending) */}
                      {rec.status === 'pending' && (
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            disabled={isBusy}
                            onClick={() => setReviewingRec(rec)}
                            className="h-7 bg-profit text-xs hover:bg-profit/80"
                          >
                            {isApproving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Shield className="mr-1 h-3 w-3" />
                                Review &amp; Approve
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => setRejectingRec(rec)}
                            className="h-7 text-xs"
                          >
                            {isRejecting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="mr-1 h-3 w-3" />
                                Reject
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Risk review dialog (approve) */}
      {reviewingRec && (
        <ApprovalDialog
          recommendationId={reviewingRec.id}
          ticker={reviewingRec.ticker}
          side={reviewingRec.side}
          quantity={reviewingRec.quantity}
          orderType={reviewingRec.order_type}
          reason={reviewingRec.reason}
          strategyName={reviewingRec.strategy_name}
          signalStrength={reviewingRec.signal_strength}
          isApproving={approveMutation.isPending && approveMutation.variables === reviewingRec.id}
          onConfirm={() => {
            approveMutation.mutate(reviewingRec.id);
            setReviewingRec(null);
          }}
          onCancel={() => setReviewingRec(null)}
          onReject={() => {
            setReviewingRec(null);
            setRejectingRec(reviewingRec);
          }}
        />
      )}

      {/* Reject dialog with reason input */}
      {rejectingRec && (
        <RejectDialog
          rec={rejectingRec}
          isRejecting={rejectMutation.isPending && rejectMutation.variables?.id === rejectingRec.id}
          onConfirm={(reason) => handleReject(rejectingRec.id, reason)}
          onCancel={() => setRejectingRec(null)}
        />
      )}
    </>
  );
}
