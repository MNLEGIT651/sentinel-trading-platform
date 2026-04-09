import { Search } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DateRange, TypeFilter } from './helpers';
import { DATE_RANGE_OPTIONS, TYPE_FILTER_OPTIONS } from './helpers';

interface OrderFiltersProps {
  dateRange: DateRange;
  typeFilter: TypeFilter;
  symbolSearch: string;
  totalEntries: number;
  hasFilters: boolean;
  onDateRange: (range: DateRange) => void;
  onTypeFilter: (filter: TypeFilter) => void;
  onSymbolSearch: (value: string) => void;
  onClearFilters: () => void;
}

export function OrderFilters({
  dateRange,
  typeFilter,
  symbolSearch,
  totalEntries,
  hasFilters,
  onDateRange,
  onTypeFilter,
  onSymbolSearch,
  onClearFilters,
}: OrderFiltersProps) {
  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
      role="search"
      aria-label="Filter orders"
    >
      <div className="flex items-center gap-2 overflow-x-auto">
        {/* Date range */}
        <div
          className="flex shrink-0 rounded-md border border-zinc-700 overflow-hidden"
          role="group"
          aria-label="Date range filter"
        >
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onDateRange(opt.value)}
              aria-label={`Filter by ${opt.label}`}
              aria-pressed={dateRange === opt.value}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors',
                dateRange === opt.value
                  ? 'bg-zinc-700 text-zinc-100 font-medium'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <Select
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value as TypeFilter)}
          aria-label="Filter by event type"
          className="shrink-0 w-auto"
        >
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        {/* Symbol / ID search */}
        <div className="relative flex-1 sm:flex-initial">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 z-10" />
          <Input
            type="text"
            placeholder="Search ID or reason…"
            value={symbolSearch}
            onChange={(e) => onSymbolSearch(e.target.value)}
            aria-label="Search orders by ID, symbol, or reason"
            className="w-full pl-8 sm:w-48"
          />
        </div>

        {hasFilters && (
          <button
            onClick={onClearFilters}
            aria-label="Clear all filters"
            className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <span className="text-xs text-zinc-600 sm:ml-auto">
        {totalEntries} {totalEntries === 1 ? 'event' : 'events'}
      </span>
    </div>
  );
}
