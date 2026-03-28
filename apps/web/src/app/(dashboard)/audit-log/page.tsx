'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { OperatorAction, OperatorActionType } from '@sentinel/shared';
import {
  useOperatorActionsQuery,
  type OperatorActionsFilters,
} from '@/hooks/queries/use-operator-actions-query';

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
};

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

// ─── Sub-components ─────────────────────────────────────────────────

function ActionTypeBadge({ actionType }: { actionType: OperatorActionType }) {
  const colors =
    ACTION_TYPE_COLORS[actionType] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${colors}`}
    >
      {ACTION_TYPE_LABELS[actionType] ?? actionType}
    </span>
  );
}

function MetadataViewer({ metadata }: { metadata: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const keys = Object.keys(metadata);
  if (keys.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

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
  return (
    <tr className="border-b border-border transition-colors hover:bg-muted/50">
      <td className="px-4 py-3">
        <ActionTypeBadge actionType={action.action_type} />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground" title={action.created_at}>
        {relativeTime(action.created_at)}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground" title={action.operator_id}>
        {truncateUuid(action.operator_id)}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {action.target_type
          ? (() => {
              const url = targetUrl(action.target_type, action.target_id);
              const content = (
                <span>
                  <span className="text-foreground">{action.target_type}</span>
                  {action.target_id && (
                    <span className="ml-1 font-mono text-xs" title={action.target_id}>
                      {truncateUuid(action.target_id)}
                    </span>
                  )}
                </span>
              );
              return url ? (
                <Link href={url} className="underline-offset-2 hover:underline hover:text-blue-400">
                  {content}
                </Link>
              ) : (
                content
              );
            })()
          : '—'}
      </td>
      <td
        className="max-w-xs truncate px-4 py-3 text-sm text-muted-foreground"
        title={action.reason ?? undefined}
      >
        {action.reason ?? '—'}
      </td>
      <td className="px-4 py-3">
        <MetadataViewer metadata={action.metadata} />
      </td>
    </tr>
  );
}

function StatsRow({ total, actions }: { total: number; actions: OperatorAction[] }) {
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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Total Actions</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{total}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Most Common</p>
        <div className="mt-1">
          {mostCommon ? (
            <ActionTypeBadge actionType={mostCommon} />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Last Action</p>
        <p className="mt-1 text-sm text-foreground">
          {lastActionTime ? relativeTime(lastActionTime) : '—'}
        </p>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);

  const filters: OperatorActionsFilters = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      ...(actionTypeFilter ? { action_type: actionTypeFilter } : {}),
    }),
    [actionTypeFilter, page],
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete record of all operator actions
        </p>
      </div>

      {/* Stats */}
      {!isLoading && !isError && actions && <StatsRow total={total} actions={actions} />}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={actionTypeFilter}
          onChange={(e) => {
            setActionTypeFilter(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="">All action types</option>
          {ACTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {ACTION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search actions…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 sm:w-64"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load audit log: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filteredActions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mb-4 h-12 w-12 text-muted-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium text-foreground">No actions recorded</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Operator actions will appear here as they occur.
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filteredActions.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
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
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !isError && total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <span className="flex items-center px-2 text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
