'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, Gavel, Shield, User, XCircle } from 'lucide-react';

import type {
  RecommendationEvent,
  RiskEvaluation,
  Order,
  Fill,
  OperatorAction,
} from '@sentinel/shared';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  useRecommendationEventsQuery,
  type RecommendationDetail,
} from '@/hooks/queries/use-recommendation-events-query';
import { useApproveRecommendationMutation } from '@/hooks/queries/use-approve-recommendation-mutation';
import { useRejectRecommendationMutation } from '@/hooks/queries/use-reject-recommendation-mutation';
import { ExplanationSection } from '@/components/advisor/explanation-section';

/* ------------------------------------------------------------------ */
/*  Status / event-type colour helpers                                */
/* ------------------------------------------------------------------ */

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-blue-500/10 text-blue-400',
  pending_approval: 'bg-blue-500/10 text-blue-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  filled: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
  risk_blocked: 'bg-red-500/10 text-red-400',
  failed: 'bg-red-500/10 text-red-400',
  cancelled: 'bg-red-500/10 text-red-400',
  submitted: 'bg-amber-500/10 text-amber-400',
  partially_filled: 'bg-amber-500/10 text-amber-400',
  risk_checked: 'bg-zinc-500/10 text-zinc-400',
  reviewed: 'bg-zinc-500/10 text-zinc-400',
  pending: 'bg-blue-500/10 text-blue-400',
  new: 'bg-blue-500/10 text-blue-400',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-zinc-500/10 text-zinc-400';
}

const SIDE_COLORS: Record<string, string> = {
  buy: 'bg-emerald-500/10 text-emerald-400',
  sell: 'bg-red-500/10 text-red-400',
};

/* ------------------------------------------------------------------ */
/*  Tiny presentational helpers                                       */
/* ------------------------------------------------------------------ */

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatEventType(t: string): string {
  return t.replace(/_/g, ' ');
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${Number(value).toFixed(2)}`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function SummaryCard({ rec }: { rec: RecommendationDetail['recommendation'] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <span className="text-muted-foreground">Quantity</span>
          <p className="font-mono text-foreground">{Number(rec.quantity)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Order Type</span>
          <p className="text-foreground">{rec.order_type}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Limit Price</span>
          <p className="font-mono text-foreground">
            {rec.limit_price != null ? `$${Number(rec.limit_price).toFixed(2)}` : '—'}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Signal Strength</span>
          <p className="font-mono text-foreground">
            {rec.signal_strength != null ? Number(rec.signal_strength).toFixed(4) : '—'}
          </p>
        </div>
      </div>

      {rec.reason && (
        <div className="text-sm">
          <span className="text-muted-foreground">Reason</span>
          <p className="mt-1 text-foreground">{rec.reason}</p>
        </div>
      )}
    </div>
  );
}

function EventTimeline({ events }: { events: RecommendationEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">No lifecycle events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Event Timeline</h2>

      <ol className="relative border-l border-border ml-3 space-y-6">
        {events.map((ev) => (
          <li key={ev.id} className="ml-6">
            {/* dot */}
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-border bg-background" />

            <div className="flex flex-wrap items-center gap-2">
              <Badge className={statusColor(ev.event_type)}>{formatEventType(ev.event_type)}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTs(ev.event_ts)}
              </span>
            </div>

            {/* actor */}
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>
                {ev.actor_type}
                {ev.actor_id ? ` · ${ev.actor_id}` : ''}
              </span>
            </div>

            {/* payload */}
            {ev.payload && Object.keys(ev.payload).length > 0 && (
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-xs text-muted-foreground">
                {JSON.stringify(ev.payload, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function RiskEvaluations({ evaluations }: { evaluations: RiskEvaluation[] }) {
  if (evaluations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Risk Evaluations</h2>

      <div className="space-y-3">
        {evaluations.map((ev) => (
          <div key={ev.id} className="rounded-lg border border-border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Badge
                className={
                  ev.allowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }
              >
                <Shield className="mr-1 h-3 w-3" />
                {ev.allowed ? 'Passed' : 'Blocked'}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatTs(ev.evaluated_at)}</span>
            </div>

            {ev.reason && <p className="text-sm text-foreground">{ev.reason}</p>}

            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
              {ev.policy_version && (
                <div>
                  <span className="text-muted-foreground">Policy</span>
                  <p className="text-foreground">{ev.policy_version}</p>
                </div>
              )}
              {ev.original_quantity != null && (
                <div>
                  <span className="text-muted-foreground">Original Qty</span>
                  <p className="font-mono text-foreground">{ev.original_quantity}</p>
                </div>
              )}
              {ev.adjusted_quantity != null && (
                <div>
                  <span className="text-muted-foreground">Adjusted Qty</span>
                  <p className="font-mono text-foreground">{ev.adjusted_quantity}</p>
                </div>
              )}
            </div>

            {/* Individual checks */}
            {Array.isArray(ev.checks_performed) && ev.checks_performed.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Checks</span>
                <div className="flex flex-wrap gap-1">
                  {ev.checks_performed.map((check, i) => (
                    <Badge
                      key={i}
                      className={
                        check.passed
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }
                    >
                      {check.name ?? `check-${i + 1}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderDetail({ order, fills }: { order: Order; fills: Fill[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Order &amp; Fill Detail</h2>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <span className="text-muted-foreground">Broker Order ID</span>
          <p className="font-mono text-foreground text-xs break-all">
            {order.broker_order_id ?? '—'}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Status</span>
          <p>
            <Badge className={statusColor(order.status)}>{formatEventType(order.status)}</Badge>
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Side / Type</span>
          <p className="text-foreground">
            {order.side} · {order.order_type}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Qty (filled / total)</span>
          <p className="font-mono text-foreground">
            {order.filled_quantity} / {order.quantity}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Avg Fill Price</span>
          <p className="font-mono text-foreground">{formatCurrency(order.filled_avg_price)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Limit Price</span>
          <p className="font-mono text-foreground">{formatCurrency(order.limit_price)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Submitted</span>
          <p className="text-xs text-foreground">{formatTs(order.submitted_at)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Filled At</span>
          <p className="text-xs text-foreground">
            {order.filled_at ? formatTs(order.filled_at) : '—'}
          </p>
        </div>
      </div>

      {/* Fills table */}
      {fills.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Fills ({fills.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-1.5 pr-4 font-medium">Time</th>
                  <th className="pb-1.5 pr-4 font-medium">Price</th>
                  <th className="pb-1.5 pr-4 font-medium">Qty</th>
                  <th className="pb-1.5 pr-4 font-medium">Commission</th>
                  <th className="pb-1.5 pr-4 font-medium">Slippage</th>
                  <th className="pb-1.5 font-medium">Venue</th>
                </tr>
              </thead>
              <tbody>
                {fills.map((fill) => (
                  <tr key={fill.id} className="border-b border-border/50">
                    <td className="py-1.5 pr-4 text-muted-foreground">{formatTs(fill.fill_ts)}</td>
                    <td className="py-1.5 pr-4 font-mono text-foreground">
                      {formatCurrency(fill.fill_price)}
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-foreground">{fill.fill_qty}</td>
                    <td className="py-1.5 pr-4 font-mono text-foreground">
                      {formatCurrency(fill.commission)}
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-foreground">
                      {fill.slippage != null ? `${Number(fill.slippage).toFixed(4)}` : '—'}
                    </td>
                    <td className="py-1.5 text-foreground">{fill.venue ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function OperatorActionsSection({ actions }: { actions: OperatorAction[] }) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Operator Actions</h2>

      <ol className="relative border-l border-border ml-3 space-y-4">
        {actions.map((action) => (
          <li key={action.id} className="ml-6">
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-border bg-background" />

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-violet-500/10 text-violet-400">
                <Gavel className="mr-1 h-3 w-3" />
                {formatEventType(action.action_type)}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTs(action.created_at)}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{action.operator_id}</span>
            </div>

            {action.reason && <p className="mt-1 text-sm text-foreground">{action.reason}</p>}

            {action.metadata && Object.keys(action.metadata).length > 0 && (
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-background p-2 text-xs text-muted-foreground">
                {JSON.stringify(action.metadata, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ApproveRejectControls({ id, status }: { id: string; status: string }) {
  const approve = useApproveRecommendationMutation();
  const reject = useRejectRecommendationMutation();
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null);

  const canAct = status === 'pending' || status === 'pending_approval';
  if (!canAct) return null;

  const isBusy = approve.isPending || reject.isPending;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Actions</h2>

      {approve.isError && (
        <p className="text-xs text-red-400">
          Approve failed: {approve.error instanceof Error ? approve.error.message : 'Unknown error'}
        </p>
      )}
      {reject.isError && (
        <p className="text-xs text-red-400">
          Reject failed: {reject.error instanceof Error ? reject.error.message : 'Unknown error'}
        </p>
      )}

      {confirming === null ? (
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            disabled={isBusy}
            onClick={() => setConfirming('approve')}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Approve &amp; Submit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isBusy}
            onClick={() => setConfirming('reject')}
          >
            <XCircle className="mr-1 h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">
            {confirming === 'approve'
              ? 'Submit this order to the broker?'
              : 'Reject this recommendation?'}
          </span>
          <Button
            variant={confirming === 'approve' ? 'default' : 'destructive'}
            size="sm"
            disabled={isBusy}
            onClick={() => {
              if (confirming === 'approve') {
                approve.mutate(id);
              } else {
                reject.mutate({ id });
              }
              setConfirming(null);
            }}
          >
            {isBusy ? 'Processing…' : 'Confirm'}
          </Button>
          <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => setConfirming(null)}>
            Cancel
          </Button>
        </div>
      )}

      {approve.isSuccess && (
        <p className="text-xs text-emerald-400">Order submitted — ID: {approve.data?.orderId}</p>
      )}
      {reject.isSuccess && <p className="text-xs text-emerald-400">Recommendation rejected.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function RecommendationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useRecommendationEventsQuery(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Loading recommendation…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 space-y-3">
        <Link
          href="/recommendations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-sm text-red-400">
          {error instanceof Error ? error.message : 'Failed to load recommendation.'}
        </p>
      </div>
    );
  }

  const { recommendation: rec, events, riskEvaluations, order, fills, operatorActions } = data;

  return (
    <div className="space-y-4 p-4">
      {/* Back link */}
      <Link
        href="/recommendations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Recommendations
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-heading-page text-foreground">{rec.ticker}</h1>
        <Badge className={SIDE_COLORS[rec.side] ?? 'bg-zinc-500/10 text-zinc-400'}>
          {rec.side?.toUpperCase()}
        </Badge>
        <Badge className={statusColor(rec.status)}>{formatEventType(rec.status)}</Badge>
        {rec.strategy_name && (
          <span className="text-sm text-muted-foreground">{rec.strategy_name}</span>
        )}
      </div>

      {/* Approve / Reject controls */}
      <ApproveRejectControls id={rec.id} status={rec.status} />

      {/* Summary */}
      <SummaryCard rec={rec} />

      {/* Why this suggestion */}
      <ExplanationSection recommendationId={rec.id} />

      {/* Timeline */}
      <EventTimeline events={events} />

      {/* Risk */}
      <RiskEvaluations evaluations={riskEvaluations} />

      {/* Order & Fills */}
      {order && <OrderDetail order={order} fills={fills} />}

      {/* Operator Actions */}
      <OperatorActionsSection actions={operatorActions} />
    </div>
  );
}
