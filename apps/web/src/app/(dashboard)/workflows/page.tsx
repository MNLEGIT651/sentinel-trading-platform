'use client';

import { useState } from 'react';
import {
  Workflow,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useWorkflowJobsQuery, useWorkflowStepsQuery } from '@/hooks/queries';
import type {
  WorkflowJob,
  WorkflowJobStatus,
  WorkflowStepLog,
  WorkflowStats,
} from '@sentinel/shared';

/* ── Helpers ──────────────────────────────────────────────────────── */

const STATUS_FILTERS: { label: string; value: WorkflowJobStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Retrying', value: 'retrying' },
];

function statusColor(status: WorkflowJobStatus | string): string {
  switch (status) {
    case 'completed':
      return 'bg-profit/15 text-profit';
    case 'running':
      return 'bg-primary/15 text-primary';
    case 'pending':
      return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400';
    case 'failed':
    case 'cancelled':
      return 'bg-destructive/15 text-destructive';
    case 'retrying':
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function statusIcon(status: WorkflowJobStatus | string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3 w-3" />;
    case 'running':
      return <Play className="h-3 w-3" />;
    case 'pending':
      return <Clock className="h-3 w-3" />;
    case 'failed':
    case 'cancelled':
      return <XCircle className="h-3 w-3" />;
    case 'retrying':
      return <RefreshCw className="h-3 w-3" />;
    default:
      return <Clock className="h-3 w-3" />;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function jobDuration(job: WorkflowJob): string | null {
  if (!job.completed_at || !job.created_at) return null;
  const ms = new Date(job.completed_at).getTime() - new Date(job.created_at).getTime();
  return formatDuration(ms);
}

function formatWorkflowType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/* ── Stats Bar ────────────────────────────────────────────────────── */

function StatsBar({ stats }: { stats: WorkflowStats }) {
  const items = [
    { label: 'Total', value: stats.total, className: 'text-foreground' },
    { label: 'Pending', value: stats.pending, className: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Running', value: stats.running, className: 'text-primary' },
    { label: 'Completed', value: stats.completed, className: 'text-profit' },
    { label: 'Failed', value: stats.failed, className: 'text-destructive' },
    { label: 'Retrying', value: stats.retrying, className: 'text-orange-600 dark:text-orange-400' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Card key={item.label} className="border-border/50">
          <CardContent className="flex items-center gap-2 px-3 py-2">
            <span className={cn('text-lg font-bold tabular-nums', item.className)}>
              {item.value}
            </span>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Step Log (expandable) ────────────────────────────────────────── */

function StepLog({ jobId }: { jobId: string }) {
  const { data, isLoading, isError } = useWorkflowStepsQuery(jobId);
  const steps = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading steps…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-xs text-destructive">
        <AlertTriangle className="h-3 w-3" />
        Failed to load steps
      </div>
    );
  }

  if (steps.length === 0) {
    return <div className="py-3 px-4 text-xs text-muted-foreground">No steps recorded yet.</div>;
  }

  return (
    <div className="border-t border-border/50 bg-muted/20">
      <div className="grid grid-cols-[1fr_80px_80px_1fr_1fr] gap-2 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Step</span>
        <span>Status</span>
        <span>Duration</span>
        <span>Output</span>
        <span>Error</span>
      </div>
      {steps.map((step: WorkflowStepLog) => (
        <div
          key={step.id}
          className="grid grid-cols-[1fr_80px_80px_1fr_1fr] gap-2 border-t border-border/30 px-4 py-2 text-xs"
        >
          <span className="font-medium text-foreground truncate">{step.step_name}</span>
          <Badge className={cn('w-fit', statusColor(step.status))} variant="secondary">
            {step.status}
          </Badge>
          <span className="text-muted-foreground tabular-nums">
            {step.duration_ms != null ? formatDuration(step.duration_ms) : '—'}
          </span>
          <span className="text-muted-foreground truncate">
            {Object.keys(step.output_data).length > 0
              ? JSON.stringify(step.output_data).slice(0, 60)
              : '—'}
          </span>
          <span className="text-destructive truncate">{step.error ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Job Row ──────────────────────────────────────────────────────── */

function JobRow({
  job,
  isExpanded,
  onToggle,
}: {
  job: WorkflowJob;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const duration = jobDuration(job);

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent/30 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        {/* Status badge */}
        <Badge className={cn('w-fit gap-1', statusColor(job.status))} variant="secondary">
          {statusIcon(job.status)}
          {job.status}
        </Badge>

        {/* Workflow type */}
        <span className="font-medium text-foreground truncate min-w-[120px]">
          {formatWorkflowType(job.workflow_type)}
        </span>

        {/* Current step */}
        <span className="hidden text-xs text-muted-foreground truncate md:block min-w-[100px]">
          {job.status === 'running' && job.current_step ? job.current_step : '—'}
        </span>

        {/* Steps progress */}
        <span className="text-xs text-muted-foreground tabular-nums min-w-[40px]">
          {job.steps_completed.length}/
          {job.steps_completed.length + (job.current_step ? 1 : 0) || '?'}
        </span>

        {/* Duration */}
        <span className="hidden text-xs text-muted-foreground tabular-nums md:block min-w-[60px]">
          {duration ?? '—'}
        </span>

        {/* Created */}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {relativeTime(job.created_at)}
        </span>

        {/* Recommendation link */}
        {job.recommendation_id && (
          <span
            className="hidden text-xs text-primary truncate lg:block max-w-[80px]"
            title={job.recommendation_id}
          >
            rec:{job.recommendation_id.slice(0, 8)}
          </span>
        )}
      </button>

      {/* Error message */}
      {job.error_message && !isExpanded && (
        <div className="flex items-center gap-2 px-4 pb-2 pl-11">
          <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
          <span className="text-xs text-destructive truncate">{job.error_message}</span>
        </div>
      )}

      {/* Expanded step log */}
      {isExpanded && <StepLog jobId={job.id} />}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function WorkflowsPage() {
  const [statusFilter, setStatusFilter] = useState<WorkflowJobStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filters = statusFilter === 'all' ? undefined : { status: statusFilter };
  const { data, isLoading, isError } = useWorkflowJobsQuery(filters);

  const jobs = data?.data ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Workflow className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Workflows</h1>
            <p className="text-xs text-muted-foreground">
              Durable workflow execution monitor • Auto-refreshes every 15s
            </p>
          </div>
        </div>
        {isLoading && (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading
          </Badge>
        )}
      </div>

      {/* Stats bar */}
      {stats && <StatsBar stats={stats} />}

      {/* Filter controls */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(f.value)}
            className="h-7 text-xs"
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Error state */}
      {isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4 px-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Failed to load workflows</p>
              <p className="text-xs text-muted-foreground">
                Check that the API is reachable and try again.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job list */}
      {!isError && (
        <Card className="border-border/50 overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="w-3.5" /> {/* chevron spacer */}
            <span className="min-w-[80px]">Status</span>
            <span className="min-w-[120px]">Type</span>
            <span className="hidden md:block min-w-[100px]">Current Step</span>
            <span className="min-w-[40px]">Steps</span>
            <span className="hidden md:block min-w-[60px]">Duration</span>
            <span className="ml-auto">Created</span>
          </div>

          {/* Loading skeleton */}
          {isLoading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-sm">Loading workflows…</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Workflow className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">No workflows found</p>
              <p className="text-xs mt-1">
                {statusFilter !== 'all'
                  ? `No ${statusFilter} workflows. Try a different filter.`
                  : 'Workflows will appear here once the engine processes them.'}
              </p>
            </div>
          )}

          {/* Job rows */}
          {jobs.map((job: WorkflowJob) => (
            <JobRow
              key={job.id}
              job={job}
              isExpanded={expandedId === job.id}
              onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
            />
          ))}
        </Card>
      )}

      {/* Footer count */}
      {!isLoading && jobs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {jobs.length} of {data?.total ?? jobs.length} workflows
        </p>
      )}
    </div>
  );
}
