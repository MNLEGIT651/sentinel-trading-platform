import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortableTableHead,
} from '@/components/ui/table';
import type { SortState } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { sideColors } from '@/lib/status-colors';
import type { Fill, RiskEvaluation } from '@sentinel/shared';
import type { OrderHistoryEntry } from '@/hooks/queries/use-order-history-query';
import {
  ENTRY_META,
  ORDER_STATUS_STYLES,
  getEntryBadgeColor,
  getEntrySide,
  getEntryStatus,
  getEntrySummary,
  formatTimestamp,
} from './helpers';
import type { TimelineEntry } from './helpers';
import { DEFAULT_ORDER_STYLE } from '@/lib/status-colors';
import { FillDetail } from './fill-detail';
import { RiskEvalDetail } from './risk-eval-detail';
import { OrderDetail } from './order-detail';

interface OrderTimelineTableProps {
  pagedEntries: TimelineEntry[];
  sortState: SortState;
  expandedId: string | null;
  onSort: (column: string) => void;
  onToggleExpand: (id: string | null) => void;
}

export function OrderTimelineTable({
  pagedEntries,
  sortState,
  expandedId,
  onSort,
  onToggleExpand,
}: OrderTimelineTableProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <Table aria-label="Orders and execution timeline">
        <TableHeader>
          <TableRow>
            <SortableTableHead column="type" sortState={sortState} onSort={onSort}>
              Type
            </SortableTableHead>
            <SortableTableHead column="symbol" sortState={sortState} onSort={onSort}>
              Symbol / ID
            </SortableTableHead>
            <TableHead>Side</TableHead>
            <SortableTableHead column="status" sortState={sortState} onSort={onSort}>
              Status
            </SortableTableHead>
            <TableHead>Summary</TableHead>
            <SortableTableHead column="timestamp" sortState={sortState} onSort={onSort}>
              Time
            </SortableTableHead>
            <TableHead className="w-10">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedEntries.map((entry) => {
            const meta = ENTRY_META[entry.type];
            const badgeColor = getEntryBadgeColor(entry);
            const Icon = meta.icon;
            const side = getEntrySide(entry);
            const status = getEntryStatus(entry);
            const statusStyle =
              entry.type === 'order'
                ? (ORDER_STATUS_STYLES[(entry.data as OrderHistoryEntry).status] ??
                  DEFAULT_ORDER_STYLE)
                : null;
            const summary = getEntrySummary(entry);
            const isExpanded = expandedId === entry.id;

            return (
              <TableRow key={entry.id}>
                {/* Type badge */}
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      badgeColor,
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                </TableCell>

                {/* Symbol / ID */}
                <TableCell className="font-mono text-xs">
                  {entry.type === 'order' ? (
                    <span className="font-semibold text-zinc-100">
                      {(entry.data as OrderHistoryEntry).symbol}
                    </span>
                  ) : entry.type === 'fill' ? (
                    <span className="text-zinc-400 truncate max-w-[100px] inline-block">
                      {(entry.data as Fill).order_id.slice(0, 8)}…
                    </span>
                  ) : (
                    <Link
                      href={`/recommendations/${(entry.data as RiskEvaluation).recommendation_id}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
                    >
                      {(entry.data as RiskEvaluation).recommendation_id.slice(0, 8)}…
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </TableCell>

                {/* Side */}
                <TableCell>
                  {side ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        sideColors[side] ?? '',
                      )}
                    >
                      {side === 'buy' ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {side.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>
                  {statusStyle ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        statusStyle.bg,
                        statusStyle.text,
                      )}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        badgeColor,
                      )}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  )}
                </TableCell>

                {/* Summary */}
                <TableCell className="max-w-[200px]">
                  <span className="text-sm text-zinc-200">{summary.primary}</span>
                  {summary.secondary && (
                    <span className="block text-xs text-zinc-500 truncate">
                      {summary.secondary}
                    </span>
                  )}
                </TableCell>

                {/* Time */}
                <TableCell className="text-xs text-zinc-500 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
                  </span>
                </TableCell>

                {/* Expand */}
                <TableCell>
                  <button
                    onClick={() => onToggleExpand(isExpanded ? null : entry.id)}
                    aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    aria-expanded={isExpanded}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Expanded detail rows */}
      {expandedId && pagedEntries.some((e) => e.id === expandedId) && (
        <div className="border-t border-zinc-800 bg-zinc-950/50 p-4">
          {(() => {
            const entry = pagedEntries.find((e) => e.id === expandedId)!;
            return (
              <>
                {entry.type === 'fill' && <FillDetail fill={entry.data as Fill} />}
                {entry.type === 'risk' && (
                  <RiskEvalDetail evaluation={entry.data as RiskEvaluation} />
                )}
                {entry.type === 'order' && <OrderDetail order={entry.data as OrderHistoryEntry} />}
              </>
            );
          })()}
        </div>
      )}
    </Card>
  );
}
