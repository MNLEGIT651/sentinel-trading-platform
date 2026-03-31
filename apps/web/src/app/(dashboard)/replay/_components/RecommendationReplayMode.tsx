'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import {
  useRecommendationSearchQuery,
  useRecommendationReplayQuery,
} from '@/hooks/queries/use-recommendation-replay-query';
import type { RecommendationSearchFilters } from '@/hooks/queries/use-recommendation-replay-query';
import { REC_STATUS_OPTIONS } from '../_constants';
import { toDateStr, formatTimestamp } from '../_helpers';
import { StatusBadge } from './StatusBadge';
import { ReconstructionView } from './ReconstructionView';

export function RecommendationReplayMode() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [ticker, setTicker] = useState('');
  const [recId, setRecId] = useState('');
  const [fromDate, setFromDate] = useState(toDateStr(thirtyDaysAgo));
  const [toDate, setToDate] = useState(toDateStr(now));
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);

  const filters: RecommendationSearchFilters = useMemo(
    () => ({
      ...(recId ? { id: recId } : {}),
      ...(ticker ? { ticker } : {}),
      from: fromDate ? new Date(fromDate).toISOString() : undefined,
      to: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      limit: 50,
    }),
    [recId, ticker, fromDate, toDate, statusFilter],
  );

  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
  } = useRecommendationSearchQuery(filters, searchSubmitted);

  const {
    data: replayData,
    isLoading: replayLoading,
    error: replayError,
  } = useRecommendationReplayQuery(selectedRecId);

  const handleSearch = useCallback(() => {
    setSearchSubmitted(true);
    setSelectedRecId(null);
  }, []);

  const handleSelectRec = useCallback((id: string) => {
    setSelectedRecId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedRecId(null);
  }, []);

  // If a recommendation is selected, show the reconstruction
  if (selectedRecId && replayData) {
    return <ReconstructionView data={replayData} onBack={handleBack} />;
  }

  return (
    <>
      {/* Search Controls */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[120px] flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Recommendation ID
            </label>
            <input
              type="text"
              value={recId}
              onChange={(e) => setRecId(e.target.value)}
              placeholder="UUID..."
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            >
              {REC_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            <Search className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            Search
          </button>
        </div>
      </div>

      {/* Loading */}
      {(searchLoading || replayLoading) && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-400" />
          <span className="ml-3 text-gray-400">
            {replayLoading ? 'Loading reconstruction…' : 'Searching…'}
          </span>
        </div>
      )}

      {/* Error */}
      {(searchError || replayError) && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-red-400">
            {(searchError || replayError)?.message || 'An error occurred'}
          </p>
        </div>
      )}

      {/* Search Results */}
      {searchData && !searchLoading && !selectedRecId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {searchData.total} recommendation{searchData.total !== 1 ? 's' : ''} found
            </span>
          </div>

          {searchData.recommendations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Search className="h-10 w-10 mb-3 text-gray-600" />
              <p className="text-sm">No recommendations match your criteria</p>
            </div>
          )}

          {searchData.recommendations.map((rec) => (
            <button
              key={rec.id}
              onClick={() => handleSelectRec(rec.id)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-left transition-colors hover:border-indigo-500/50 hover:bg-gray-750"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 min-w-[120px]">
                  <span className="text-sm font-semibold text-white">{rec.ticker}</span>
                  <StatusBadge status={rec.side} />
                </div>
                <StatusBadge status={rec.status} />
                {rec.strategy_name && (
                  <span className="text-xs text-gray-500">{rec.strategy_name}</span>
                )}
                {rec.signal_strength != null && (
                  <span className="text-xs text-gray-500 font-mono">
                    str: {(Number(rec.signal_strength) * 100).toFixed(0)}%
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-500 flex-shrink-0">
                  {formatTimestamp(rec.created_at)}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
              </div>
              {rec.reason && <p className="mt-1 text-xs text-gray-400 truncate">{rec.reason}</p>}
            </button>
          ))}
        </div>
      )}

      {/* Prompt before first search */}
      {!searchSubmitted && !searchLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Search className="h-12 w-12 mb-4 text-gray-600" />
          <p className="text-lg font-medium text-gray-400">Search for a recommendation to replay</p>
          <p className="text-sm mt-1">Find by ticker, date range, or paste a recommendation ID</p>
        </div>
      )}
    </>
  );
}
