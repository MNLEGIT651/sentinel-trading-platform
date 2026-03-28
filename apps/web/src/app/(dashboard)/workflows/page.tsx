'use client';

import { useState, useMemo } from 'react';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Ban,
  Activity,
  Timer,
  TrendingDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useWorkflowJobsQuery, useWorkflowStepsQuery } from '@/hooks/queries';
import type {
  WorkflowJob,
  WorkflowJobStatus,
  WorkflowType,
  WorkflowStepLog,
  WorkflowStats,
  WorkflowJobsFilters,
} from '@sentinel/shared';

/* ── Constants ────────────────────────────────────────────────────── */

const STATUS_FILTERS: { label: string; value: WorkflowJobStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Retrying', value: 'retrying' },
  { label: 'Cancelled', value: 'cancelled' },
];

const WORKFLOW_TYPES: { label: string; value: WorkflowType | 'all' }[] = [
  { label: 'All Types', value: 'all' },
  { label: 'Recommendation', value: 'recommendation_lifecycle' },
  { label: 'Order Execution', value: 'order_execution' },
  { label: 'Risk Evaluation', value: 'risk_evaluation' },
  { label: 'Agent Cycle', value: 'agent_cycle' },
];

type SortField = 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

/* ── Helpers ──────────────────────────────────────────────────────── */

function statusColor(status: WorkflowJobStatus | string): string {
  switch (status) {
    case 'completed':
      return 'bg-profit/15 text-profit';
    case 'running':
      return 'bg-primary/15 text-primary';
    case 'pending':
      return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400';
    case 'failed':
      return 'bg-destructive/15 text-destructive';
    case 'cancelled':
      return 'bg-muted text-muted-foreground';
    case 'retrying':
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function stepStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-profit/15 text-profit';
    case 'started':
      return 'bg-primary/15 text-primary';
    case 'failed':
      return 'bg-destructive/15 text-destructive';
    case 'skipped':
      return 'bg-muted text-muted-foreground';
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
      return <XCircle className="h-3 w-3" />;
    case 'cancelled':
      return <Ban className="h-3 w-3" />;
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
  const start = job.started_at ?? job.created_at;
  const end = job.completed_at;
  if (!end || !start) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return formatDuration(ms);
}

function formatWorkflowType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/* ── Stats Bar ────────────────────────────────────────────────────── */

function StatsBar({ stats }: { stats: WorkflowStats }) {
  const statusItems = [
    { label: 'Total', value: stats.total, className: 'text-foreground' },
    { label: 'Pending', value: stats.pending, className: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Running', value: stats.running, className: 'text-primary' },
    { label: 'Completed', value: stats.completed, className: 'text-profit' },
    { label: 'Failed', value: stats.failed, className: 'text-destructive' },
    { label: 'Retrying', value: stats.retrying, className: 'text-orange-600 dark:text-orange-400' },
    { label: 'Cancelled', value: stats.cancelled, className: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-2">
      {/* Status counts */}
      <div className="flex flex-wrap gap-2">
        {statusItems.map((item) => (
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

      {/* Derived metrics */}
      <div className="flex flex-wrap gap-2">
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-2 px-3 py-2">
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold tabular-nums">
              {stats.avg_duration_ms != null ? formatDuration(stats.avg_duration_ms) : '—'}
            </span>
            <span className="text-xs text-muted-foreground">Avg Completion</span>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-2 px-3 py-2">
            <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                stats.failure_rate != null && stats.failure_rate > 20
                  ? 'text-destructive'
                  : stats.failure_rate != null && stats.failure_rate > 10
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-foreground',
              )}
            >
              {stats.failure_rate != null ? `${stats.failure_rate}%` : '—'}
            </span>
            <span className="text-xs text-muted-foreground">Failure Rate</span>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-2 px-3 py-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold tabular-nums text-primary">{stats.running}</span>
            <span className="text-xs text-muted-foreground">Active Jobs</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Step Timeline ────────────────────────────────────────────────── */

function StepTimeline({ jobId }: { jobId: string }) {
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
      <div className="grid grid-cols-[1fr_80px_80px_120px_1fr] gap-2 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Step</span>
        <span>Status</span>
        <span>Duration</span>
        <span>Executed</span>
        <span>Error</span>
      </div>
      {steps.map((step: WorkflowStepLog) => (
        <div
          key={step.id}
          className="grid grid-cols-[1fr_80px_80px_120px_1fr] gap-2 border-t border-border/30 px-4 py-2 text-xs"
        >
          <span className="font-medium text-foreground truncate">{step.step_name}</span>
          <Badge className={cn('w-fit', stepStatusColor(step.status))} variant="secondary">
            {step.status}
          </Badge>
          <span className="text-muted-foreground tabular-nums">
            {step.duration_ms != null ? formatDuration(step.duration_ms) : '—'}
          </span>
          <span className="text-muted-foreground tabular-nums truncate">
            {formatTimestamp(step.executed_at)}
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

        {/* Job ID (truncated) */}
        <span
          className="hidden text-[10px] font-mono text-muted-foreground lg:block min-w-[70px]"
          title={job.id}
        >
          {job.id.slice(0, 8)}
        </span>

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

      {/* Error message (collapsed view) */}
      {job.error_message && !isExpanded && (
        <div className="flex items-center gap-2 px-4 pb-2 pl-11">
          <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
          <span className="text-xs text-destructive truncate">{job.error_message}</span>
        </div>
      )}

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="border-t border-border/50">
          {/* Job detail grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3 bg-muted/10 text-xs">
            <div>
              <span className="text-muted-foreground">Job ID</span>
              <p className="font-mono text-foreground truncate" title={job.id}>
                {job.id}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Workflow Type</span>
              <p className="text-foreground">{formatWorkflowType(job.workflow_type)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Error Count</span>
              <p
                className={cn(
                  'tabular-nums',
                  job.error_count > 0 ? 'text-destructive' : 'text-foreground',
                )}
              >
                {job.error_count} / {job.max_retries} max
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Steps</span>
              <p className="text-foreground">{job.steps_completed.join(' → ') || 'None'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="text-foreground tabular-nums">{formatTimestamp(job.created_at)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Started</span>
              <p className="text-foreground tabular-nums">{formatTimestamp(job.started_at)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Completed</span>
              <p className="text-foreground tabular-nums">{formatTimestamp(job.completed_at)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Duration</span>
              <p className="text-foreground tabular-nums">{duration ?? '—'}</p>
            </div>
            {job.error_message && (
              <div className="col-span-2 md:col-span-4">
                <span className="text-muted-foreground">Error</span>
                <p className="text-destructive break-words">{job.error_message}</p>
              </div>
            )}
          </div>

          {/* Step timeline */}
          <StepTimeline jobId={job.id} />
        </div>
      )}
    </div>
  );
}

/* ── Sort Header Button ───────────────────────────────────────────── */

function SortButton({
  label,
  field,
  active,
  direction,
  onClick,
}: {
  label: string;
  field: SortField;
  active: boolean;
  direction: SortDirection;
  onClick: (field: SortField) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70',
      )}
      onClick={() => onClick(field)}
    >
      {label}
      {active ? (
        direction === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
      )}
    </button>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function WorkflowsPage() {
  const [statusFilter, setStatusFilter] = useState<WorkflowJobStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<WorkflowType | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filters: WorkflowJobsFilters | undefined = useMemo(() => {
    const f: WorkflowJobsFilters = {};
    if (statusFilter !== 'all') f.status = statusFilter;
    if (typeFilter !== 'all') f.workflow_type = typeFilter;
    f.sort_by = sortBy;
    f.sort_direction = sortDirection;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [statusFilter, typeFilter, sortBy, sortDirection]);

  const { data, isLoading, isError } = useWorkflowJobsQuery(filters);

  const jobs = data?.data ?? [];
  const stats = data?.stats;

  function handleSort(field: SortField) {
    if (field === sortBy) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  }

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
      <div className="space-y-2">
        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mr-1">
            Status
          </span>
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

        {/* Workflow type filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mr-1">
            Type
          </span>
          {WORKFLOW_TYPES.map((t) => (
            <Button
              key={t.value}
              variant={typeFilter === t.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(t.value)}
              className="h-7 text-xs"
            >
              {t.label}
            </Button>
          ))}
        </div>
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
          {/* Column headers with sort controls */}
          <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2">
            <span className="w-3.5" /> {/* chevron spacer */}
            <span className="hidden lg:block min-w-[70px] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              ID
            </span>
            <span className="min-w-[80px] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            <span className="min-w-[120px] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Type
            </span>
            <span className="hidden md:block min-w-[100px] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Current Step
            </span>
            <span className="min-w-[40px] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Steps
            </span>
            <span className="hidden md:block min-w-[60px] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Duration
            </span>
            <span className="ml-auto">
              <SortButton
                label="Created"
                field="created_at"
                active={sortBy === 'created_at'}
                direction={sortDirection}
                onClick={handleSort}
              />
            </span>
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
                {statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'No matching workflows. Try adjusting your filters.'
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
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {jobs.length} of {data?.total ?? jobs.length} workflows
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Sort by
            </span>
            <SortButton
              label="Created"
              field="created_at"
              active={sortBy === 'created_at'}
              direction={sortDirection}
              onClick={handleSort}
            />
            <SortButton
              label="Updated"
              field="updated_at"
              active={sortBy === 'updated_at'}
              direction={sortDirection}
              onClick={handleSort}
            />
          </div>
        </div>
      )}
    </div>
  );
}
