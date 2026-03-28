'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { OperatorAction, OperatorActionType } from '@sentinel/shared';
import {
  useOperatorActionsQuery,
  type OperatorActionsFilters,
} from '@/hooks/queries/use-operator-actions-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, ChevronDown, ChevronUp, ExternalLink, Filter, X } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────

const ACTION_TYPES: OperatorActionType[] = [
  'halt_trading',
  'resume_trading',
  'approve_recommendation',
  'reject_recommendation',
  'update_policy',
  'change_mode',
  'override_risk',
  'cancel_order',
  'manual_order',
  'role_change',
  'system_config_change',
];

const TARGET_TYPES = [
  'recommendation',
  'order',
  'system',
  'policy',
  'risk_policy',
  'user',
  'role',
] as const;

const ACTION_TYPE_LABELS: Record<OperatorActionType, string> = {
  halt_trading: 'Halt Trading',
  resume_trading: 'Resume Trading',
  approve_recommendation: 'Approve Recommendation',
  reject_recommendation: 'Reject Recommendation',
  update_policy: 'Update Policy',
  change_mode: 'Change Mode',
  override_risk: 'Override Risk',
  cancel_order: 'Cancel Order',
  manual_order: 'Manual Order',
  role_change: 'Role Change',
  system_config_change: 'System Config Change',
  incident_fallback: 'Incident Fallback',
};

const ACTION_TYPE_COLORS: Record<OperatorActionType, string> = {
  halt_trading: 'bg-red-500/15 text-red-400 border-red-500/30',
  resume_trading: 'bg-green-500/15 text-green-400 border-green-500/30',
  approve_recommendation: 'bg-green-500/15 text-green-400 border-green-500/30',
  reject_recommendation: 'bg-red-500/15 text-red-400 border-red-500/30',
  update_policy: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  change_mode: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  system_config_change: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  override_risk: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  cancel_order: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  manual_order: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  role_change: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  incident_fallback: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

type DateRangePreset = '' | '24h' | '7d' | '30d';

const DATE_RANGE_PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: 'All Time', value: '' },
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7d', value: '7d' },
  { label: 'Last 30d', value: '30d' },
];

const PAGE_SIZE = 20;

// ─── Helpers ────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function truncateUuid(uuid: string): string {
  return uuid.length > 8 ? `${uuid.slice(0, 8)}…` : uuid;
}

function targetUrl(targetType: string | null, targetId: string | null): string | null {
  if (!targetType || !targetId) return null;
  const t = targetType.toLowerCase();
  if (t === 'recommendation') return `/recommendations/${targetId}`;
  if (t === 'order') return `/orders`;
  if (t === 'policy' || t === 'risk_policy') return `/settings`;
  if (t === 'user' || t === 'role') return `/roles`;
  return null;
}

function getDateRangeFrom(preset: DateRangePreset): string | undefined {
  if (!preset) return undefined;
  const now = new Date();
  const hours = preset === '24h' ? 24 : preset === '7d' ? 168 : 720;
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

// ─── Sub-components ─────────────────────────────────────────────────

function ActionTypeBadge({ actionType }: { actionType: OperatorActionType }) {
  const colors =
    ACTION_TYPE_COLORS[actionType] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {ACTION_TYPE_LABELS[actionType] ?? actionType}
    </span>
  );
}

function ExpandableReason({ reason }: { reason: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!reason) return <span className="text-xs text-muted-foreground">—</span>;

  const isLong = reason.length > 80;

  if (!isLong) {
    return <span className="text-sm text-muted-foreground">{reason}</span>;
  }

  return (
    <div className="space-y-1">
      <span className="text-sm text-muted-foreground">
        {expanded ? reason : `${reason.slice(0, 80)}…`}
      </span>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="ml-1 inline-flex items-center gap-0.5 text-xs text-blue-400 hover:text-blue-300"
      >
        {expanded ? (
          <>
            Less <ChevronUp className="h-3 w-3" />
          </>
        ) : (
          <>
            More <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>
    </div>
  );
}

function MetadataViewer({ metadata }: { metadata: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const keys = Object.keys(metadata);
  if (keys.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="text-xs text-blue-400 underline-offset-2 hover:text-blue-300 hover:underline"
      >
        {expanded ? 'Hide' : 'Show'} metadata ({keys.length} {keys.length === 1 ? 'key' : 'keys'})
      </button>
      {expanded && (
        <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ActionRow({ action }: { action: OperatorAction }) {
  const url = targetUrl(action.target_type, action.target_id);

  return (
    <tr className="border-b border-border transition-colors hover:bg-muted/50">
      <td className="px-4 py-3">
        <ActionTypeBadge actionType={action.action_type} />
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-foreground" title={formatAbsoluteTime(action.created_at)}>
          {relativeTime(action.created_at)}
        </div>
        <div className="text-xs text-muted-foreground">{formatAbsoluteTime(action.created_at)}</div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground" title={action.operator_id}>
        {truncateUuid(action.operator_id)}
      </td>
      <td className="px-4 py-3 text-sm">
        {action.target_type ? (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-xs">
              {action.target_type}
            </Badge>
            {action.target_id && (
              <>
                {url ? (
                  <Link
                    href={url}
                    className="inline-flex items-center gap-1 font-mono text-xs text-blue-400 underline-offset-2 hover:underline"
                  >
                    {truncateUuid(action.target_id)}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  <span
                    className="font-mono text-xs text-muted-foreground"
                    title={action.target_id}
                  >
                    {truncateUuid(action.target_id)}
                  </span>
                )}
              </>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="max-w-xs px-4 py-3">
        <ExpandableReason reason={action.reason} />
      </td>
      <td className="px-4 py-3">
        <MetadataViewer metadata={action.metadata} />
      </td>
    </tr>
  );
}

function StatsRow({
  total,
  actions,
  isLoading,
}: {
  total: number;
  actions: OperatorAction[];
  isLoading: boolean;
}) {
  const mostCommon = useMemo(() => {
    if (actions.length === 0) return null;
    const counts = new Map<string, number>();
    for (const a of actions) {
      counts.set(a.action_type, (counts.get(a.action_type) ?? 0) + 1);
    }
    let best = '';
    let bestCount = 0;
    for (const [type, count] of counts) {
      if (count > bestCount) {
        best = type;
        bestCount = count;
      }
    }
    return best as OperatorActionType;
  }, [actions]);

  const lastActionTime = actions[0]?.created_at ?? null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} size="sm">
            <CardContent>
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-7 w-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card size="sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">Total Actions</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{total}</p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">Most Common</p>
          <div className="mt-1">
            {mostCommon ? (
              <ActionTypeBadge actionType={mostCommon} />
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">Last Action</p>
          <p className="mt-1 text-sm text-foreground">
            {lastActionTime ? relativeTime(lastActionTime) : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRangePreset>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);

  const hasActiveFilters = actionTypeFilter || targetTypeFilter || dateRange || searchTerm;

  const clearFilters = useCallback(() => {
    setActionTypeFilter('');
    setTargetTypeFilter('');
    setDateRange('');
    setSearchTerm('');
    setPage(0);
  }, []);

  const filters: OperatorActionsFilters = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      ...(actionTypeFilter ? { action_type: actionTypeFilter } : {}),
      ...(targetTypeFilter ? { target_type: targetTypeFilter } : {}),
      ...(dateRange ? { from: getDateRangeFrom(dateRange) } : {}),
    }),
    [actionTypeFilter, targetTypeFilter, dateRange, page],
  );

  const { data: response, isLoading, isError, error } = useOperatorActionsQuery(filters);

  const actions = response?.data;
  const total = response?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filteredActions = useMemo(() => {
    const list = actions ?? [];
    if (!searchTerm.trim()) return list;
    const lower = searchTerm.toLowerCase();
    return list.filter(
      (a) =>
        a.action_type.toLowerCase().includes(lower) ||
        a.operator_id.toLowerCase().includes(lower) ||
        (a.target_type?.toLowerCase().includes(lower) ?? false) ||
        (a.target_id?.toLowerCase().includes(lower) ?? false) ||
        (a.reason?.toLowerCase().includes(lower) ?? false),
    );
  }, [actions, searchTerm]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
              <p className="text-sm text-muted-foreground">
                Complete record of all operator actions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsRow total={total} actions={actions ?? []} isLoading={isLoading} />

      {/* Filters */}
      <Card size="sm">
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Filters</span>
              {hasActiveFilters && (
                <Button variant="ghost" size="xs" onClick={clearFilters}>
                  <X className="h-3 w-3" />
                  Clear all
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              {/* Action type filter */}
              <select
                value={actionTypeFilter}
                onChange={(e) => {
                  setActionTypeFilter(e.target.value);
                  setPage(0);
                }}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="">All action types</option>
                {ACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ACTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>

              {/* Target type filter */}
              <select
                value={targetTypeFilter}
                onChange={(e) => {
                  setTargetTypeFilter(e.target.value);
                  setPage(0);
                }}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="">All target types</option>
                {TARGET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>

              {/* Date range presets */}
              <div className="flex gap-1">
                {DATE_RANGE_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={dateRange === preset.value ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDateRange(preset.value);
                      setPage(0);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Search actions…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 sm:w-56"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card>
          <CardContent>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
              Failed to load audit log: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filteredActions.length === 0 && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-medium text-foreground">No actions recorded</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilters
                  ? 'No actions match your current filters. Try adjusting or clearing them.'
                  : 'Operator actions will appear here as they occur.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isLoading && !isError && filteredActions.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Action
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Time
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Operator
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Target
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Metadata
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActions.map((action) => (
                    <ActionRow key={action.id} action={action} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && !isError && total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
