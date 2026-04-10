'use client';

import { useState, useMemo, useCallback } from 'react';
import { ArrowUpDown, Activity, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { Spinner } from '@/components/ui/spinner';
import { useFillsQuery, useRiskEvaluationsQuery, useOrderHistoryQuery } from '@/hooks/queries';
import type { Fill, RiskEvaluation } from '@sentinel/shared';
import type { OrderHistoryEntry } from '@/hooks/queries/use-order-history-query';
import type { SortState } from '@/components/ui/table';
import { PAGE_SIZE_ORDERS } from '@/lib/constants';
import { humanizeFetchError } from '@/lib/humanize-fetch-error';
import {
  StatsRow,
  OrderFilters,
  OrderTimelineTable,
  getDateRangeFrom,
  getEntrySymbol,
  getEntryStatus,
} from '@/components/orders';
import type { DateRange, TypeFilter, TimelineEntry } from '@/components/orders';

// ─── Main Page ──────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortState, setSortState] = useState<SortState>({ column: 'timestamp', direction: 'desc' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageSize = PAGE_SIZE_ORDERS;

  const from = useMemo(() => getDateRangeFrom(dateRange), [dateRange]);

  const fillsQuery = useFillsQuery({
    limit: 200,
    from: from,
  });

  const riskQuery = useRiskEvaluationsQuery({
    limit: 200,
  });

  const ordersQuery = useOrderHistoryQuery(200);

  const isLoading = fillsQuery.isLoading || riskQuery.isLoading || ordersQuery.isLoading;

  const fills = useMemo(() => fillsQuery.data?.data ?? [], [fillsQuery.data]);
  const riskEvals = useMemo(() => riskQuery.data?.data ?? [], [riskQuery.data]);
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  const failedSources = useMemo(() => {
    const sources: { label: string; message: string }[] = [];
    if (fillsQuery.isError)
      sources.push({
        label: 'Fills',
        message: humanizeFetchError(fillsQuery.error, { subject: 'fills' }),
      });
    if (riskQuery.isError)
      sources.push({
        label: 'Risk evaluations',
        message: humanizeFetchError(riskQuery.error, { subject: 'risk evaluations' }),
      });
    if (ordersQuery.isError)
      sources.push({
        label: 'Orders',
        message: humanizeFetchError(ordersQuery.error, { subject: 'order history' }),
      });
    return sources;
  }, [
    fillsQuery.isError,
    fillsQuery.error,
    riskQuery.isError,
    riskQuery.error,
    ordersQuery.isError,
    ordersQuery.error,
  ]);

  const allFailed = failedSources.length === 3;
  const hasPartialFailure = failedSources.length > 0 && !allFailed;

  const retryAll = useCallback(() => {
    void fillsQuery.refetch();
    void riskQuery.refetch();
    void ordersQuery.refetch();
  }, [fillsQuery, riskQuery, ordersQuery]);

  // Build unified timeline
  const timeline = useMemo(() => {
    const entries: TimelineEntry[] = [];

    if (typeFilter === 'all' || typeFilter === 'fills') {
      for (const fill of fills) {
        entries.push({
          id: `fill-${fill.id}`,
          type: 'fill',
          timestamp: fill.fill_ts,
          data: fill,
        });
      }
    }

    if (typeFilter === 'all' || typeFilter === 'orders') {
      for (const order of orders) {
        const ts = order.filled_at ?? order.submitted_at ?? new Date().toISOString();
        if (from && new Date(ts) < new Date(from)) {
          continue;
        }
        entries.push({
          id: `order-${order.order_id}`,
          type: 'order',
          timestamp: ts,
          data: order,
        });
      }
    }

    if (typeFilter === 'all' || typeFilter === 'risk') {
      for (const risk of riskEvals) {
        // Filter risk evals by date range client-side
        if (from && new Date(risk.evaluated_at) < new Date(from)) {
          continue;
        }
        entries.push({
          id: `risk-${risk.id}`,
          type: 'risk',
          timestamp: risk.evaluated_at,
          data: risk,
        });
      }
    }

    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Symbol search — filter by order_id, symbol, or reason (partial match)
    if (symbolSearch.trim()) {
      const q = symbolSearch.trim().toLowerCase();
      return entries.filter((e) => {
        if (e.type === 'fill') {
          const fill = e.data as Fill;
          return fill.order_id.toLowerCase().includes(q) || fill.id.toLowerCase().includes(q);
        }
        if (e.type === 'order') {
          const order = e.data as OrderHistoryEntry;
          return (
            order.symbol.toLowerCase().includes(q) ||
            order.order_id.toLowerCase().includes(q) ||
            order.side.toLowerCase().includes(q) ||
            order.status.toLowerCase().includes(q) ||
            (order.risk_note?.toLowerCase().includes(q) ?? false)
          );
        }
        if (e.type === 'risk') {
          const risk = e.data as RiskEvaluation;
          return (
            risk.recommendation_id.toLowerCase().includes(q) ||
            risk.id.toLowerCase().includes(q) ||
            (risk.reason?.toLowerCase().includes(q) ?? false)
          );
        }
        return true;
      });
    }

    return entries;
  }, [fills, riskEvals, orders, typeFilter, from, symbolSearch]);

  // Sort timeline
  const sortedTimeline = useMemo(() => {
    if (!sortState.direction) return timeline;
    const dir = sortState.direction === 'asc' ? 1 : -1;
    return [...timeline].sort((a, b) => {
      switch (sortState.column) {
        case 'timestamp':
          return dir * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        case 'type':
          return dir * a.type.localeCompare(b.type);
        case 'symbol': {
          const symA = getEntrySymbol(a);
          const symB = getEntrySymbol(b);
          return dir * symA.localeCompare(symB);
        }
        case 'status': {
          const stA = getEntryStatus(a);
          const stB = getEntryStatus(b);
          return dir * stA.localeCompare(stB);
        }
        default:
          return 0;
      }
    });
  }, [timeline, sortState]);

  // Paginate
  const totalEntries = sortedTimeline.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const pagedEntries = sortedTimeline.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = useCallback((column: string) => {
    setSortState((prev) => {
      if (prev.column === column) {
        const next = prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc';
        return { column, direction: next };
      }
      return { column, direction: 'asc' };
    });
    setPage(0);
  }, []);

  const handleDateRange = useCallback((range: DateRange) => {
    setDateRange(range);
    setPage(0);
  }, []);

  const handleTypeFilter = useCallback((filter: TypeFilter) => {
    setTypeFilter(filter);
    setPage(0);
  }, []);

  const handleSymbolSearch = useCallback((value: string) => {
    setSymbolSearch(value);
    setPage(0);
  }, []);

  const handleClearFilters = useCallback(() => {
    setDateRange('all');
    setTypeFilter('all');
    setSymbolSearch('');
    setPage(0);
  }, []);

  const hasFilters = dateRange !== 'all' || typeFilter !== 'all' || symbolSearch !== '';

  return (
    <ErrorBoundary>
      <div className="space-y-4 sm:space-y-6 page-enter">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <ArrowUpDown className="h-5 w-5 sm:h-6 sm:w-6 text-zinc-400" />
          <div>
            <h1 className="text-heading-page text-zinc-100">Orders &amp; Fills</h1>
            <p className="text-xs sm:text-sm text-zinc-500">Execution activity timeline</p>
          </div>
        </div>

        {/* Stats */}
        <StatsRow fills={fills} riskEvals={riskEvals} orders={orders} isLoading={isLoading} />

        {/* Filters */}
        <OrderFilters
          dateRange={dateRange}
          typeFilter={typeFilter}
          symbolSearch={symbolSearch}
          totalEntries={totalEntries}
          hasFilters={hasFilters}
          onDateRange={handleDateRange}
          onTypeFilter={handleTypeFilter}
          onSymbolSearch={handleSymbolSearch}
          onClearFilters={handleClearFilters}
        />

        {/* Timeline Table */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {hasPartialFailure && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              Some data sources failed to load:{' '}
              {failedSources.map((s) => `${s.label} — ${s.message}`).join(' · ')} Showing available
              entries.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={retryAll}
              className="h-7 gap-1 px-2 text-xs text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        )}

        {allFailed && (
          <ErrorState
            title="Failed to load data"
            message={failedSources[0]?.message ?? 'Could not load execution data.'}
            onRetry={retryAll}
          />
        )}

        {!isLoading && !allFailed && pagedEntries.length === 0 && (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="p-12 text-center">
              <Activity className="mx-auto h-10 w-10 text-zinc-700" />
              <h3 className="mt-4 text-lg font-medium text-zinc-400">No execution activity yet</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Fills and risk evaluations will appear here as trades are executed.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !allFailed && pagedEntries.length > 0 && (
          <OrderTimelineTable
            pagedEntries={pagedEntries}
            sortState={sortState}
            expandedId={expandedId}
            onSort={handleSort}
            onToggleExpand={setExpandedId}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              aria-label="Go to previous page"
              className="rounded px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-xs text-zinc-500">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Go to next page"
              className="rounded px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </ErrorBoundary>
  );
}
