'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Shield, User } from 'lucide-react';

import type { RecommendationEvent, RiskEvaluation } from '@sentinel/shared';

import { cn } from '@/lib/utils';
import {
  useRecommendationEventsQuery,
  type RecommendationDetail,
} from '@/hooks/queries/use-recommendation-events-query';

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
  // fallback for recommendation-level status
  pending: 'bg-blue-500/10 text-blue-400',
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

            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
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

  const { recommendation: rec, events, riskEvaluations } = data;

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
        <h1 className="text-xl font-semibold text-foreground">{rec.ticker}</h1>
        <Badge className={SIDE_COLORS[rec.side] ?? 'bg-zinc-500/10 text-zinc-400'}>
          {rec.side?.toUpperCase()}
        </Badge>
        <Badge className={statusColor(rec.status)}>{formatEventType(rec.status)}</Badge>
        {rec.strategy_name && (
          <span className="text-sm text-muted-foreground">{rec.strategy_name}</span>
        )}
      </div>

      {/* Summary */}
      <SummaryCard rec={rec} />

      {/* Timeline */}
      <EventTimeline events={events} />

      {/* Risk */}
      <RiskEvaluations evaluations={riskEvaluations} />
    </div>
  );
}
