'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
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

// ── Filter / sort types ────────────────────────────────────────────

type SideFilter = 'all' | 'buy' | 'sell';
type SortOption = 'newest' | 'strength';

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
        <div className="text-[11px] text-muted-foreground">Pending</div>
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

// ── Main page ──────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { data: recommendations, isLoading, isError } = useRecommendationsQuery('pending');
  const approveMutation = useApproveRecommendationMutation();
  const rejectMutation = useRejectRecommendationMutation();

  const [reviewingRec, setReviewingRec] = useState<TradeRecommendation | null>(null);
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Derive unique strategy names for the filter dropdown
  const strategies = useMemo(() => {
    if (!recommendations) return [];
    const names = new Set<string>();
    for (const r of recommendations) {
      if (r.strategy_name) names.add(r.strategy_name);
    }
    return Array.from(names).sort();
  }, [recommendations]);

  // Filter and sort
  const filtered = useMemo(() => {
    if (!recommendations) return [];
    let list = [...recommendations];

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
      const aStr = a.signal_strength ?? -1;
      const bStr = b.signal_strength ?? -1;
      return bStr - aStr;
    });

    return list;
  }, [recommendations, sideFilter, strategyFilter, sortBy]);

  // ── Loading state ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Pending Approvals</h1>
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
          <h1 className="text-lg font-semibold text-foreground">Pending Approvals</h1>
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
            <h1 className="text-lg font-semibold text-foreground">Pending Approvals</h1>
            {allRecs.length > 0 && (
              <Badge className="border bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                {allRecs.length} awaiting review
              </Badge>
            )}
          </div>
        </div>

        {/* Stats bar — always computed from unfiltered pending recs */}
        <StatsBar recommendations={allRecs} />

        {/* Filters */}
        <Card className="border-border bg-card">
          <CardContent className="flex flex-wrap items-center gap-3 py-3">
            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />

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
              {(['newest', 'strength'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSortBy(opt)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    sortBy === opt
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {opt === 'newest' ? 'Newest' : 'Strength'}
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
                All caught up! No pending approvals.
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {allRecs.length > 0
                  ? 'No recommendations match the current filters.'
                  : 'New recommendations will appear here when agents generate them.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recommendation cards */}
        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((rec) => {
              const isApproving = approveMutation.isPending && approveMutation.variables === rec.id;
              const isRejecting = rejectMutation.isPending && rejectMutation.variables === rec.id;
              const isBusy = isApproving || isRejecting;

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
                              {rec.quantity} shares @ {rec.order_type}
                            </span>
                            {rec.signal_strength != null && (
                              <Badge className="border border-blue-500/20 bg-blue-500/10 text-[9px] text-blue-400">
                                {(rec.signal_strength * 100).toFixed(0)}% signal
                              </Badge>
                            )}
                          </div>

                          {rec.strategy_name && (
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {rec.strategy_name}
                            </div>
                          )}

                          {rec.reason && (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                              {rec.reason}
                            </p>
                          )}

                          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(rec.created_at).toLocaleString()}
                            </span>
                            <Link
                              href={`/recommendations/${rec.id}`}
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Full details
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* Right: action buttons */}
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
                          onClick={() => rejectMutation.mutate(rec.id)}
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
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Risk review dialog */}
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
            rejectMutation.mutate(reviewingRec.id);
            setReviewingRec(null);
          }}
        />
      )}
    </>
  );
}
