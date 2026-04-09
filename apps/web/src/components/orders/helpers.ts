import type { Fill, RiskEvaluation } from '@sentinel/shared';
import type { OrderHistoryEntry } from '@/hooks/queries/use-order-history-query';
import { orderStatusColors, DEFAULT_ORDER_STYLE } from '@/lib/status-colors';
import { CheckCircle, Shield, FileText } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────

export type TimelineEntryType = 'fill' | 'risk' | 'order';

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  timestamp: string;
  data: Fill | RiskEvaluation | OrderHistoryEntry;
}

export type DateRange = 'today' | 'week' | 'month' | 'all';
export type TypeFilter = 'all' | 'fills' | 'risk' | 'orders';

// ─── Constants ─────────────────────────────────────────────────────────

export const ENTRY_META: Record<TimelineEntryType, { label: string; icon: typeof CheckCircle }> = {
  fill: { label: 'Fill', icon: CheckCircle },
  risk: { label: 'Risk Eval', icon: Shield },
  order: { label: 'Order', icon: FileText },
};

export const ORDER_STATUS_STYLES = orderStatusColors;

export const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All' },
];

export const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'orders', label: 'Orders' },
  { value: 'fills', label: 'Fills' },
  { value: 'risk', label: 'Risk Evals' },
];

// ─── Helpers ───────────────────────────────────────────────────────────

export function getDateRangeFrom(range: DateRange): string | undefined {
  if (range === 'all') return undefined;
  const now = new Date();
  if (range === 'today') {
    now.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    now.setDate(now.getDate() - 7);
  } else if (range === 'month') {
    now.setMonth(now.getMonth() - 1);
  }
  return now.toISOString();
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

export function formatCurrency(val: number): string {
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getEntryBadgeColor(entry: TimelineEntry): string {
  if (entry.type === 'fill') {
    return 'bg-green-500/15 text-green-400';
  }
  if (entry.type === 'order') {
    const order = entry.data as OrderHistoryEntry;
    const style = ORDER_STATUS_STYLES[order.status] ?? DEFAULT_ORDER_STYLE;
    return `${style.bg} ${style.text}`;
  }
  const risk = entry.data as RiskEvaluation;
  return risk.allowed ? 'bg-orange-500/15 text-orange-400' : 'bg-red-500/15 text-red-400';
}

export function getEntrySymbol(entry: TimelineEntry): string {
  if (entry.type === 'order') return (entry.data as OrderHistoryEntry).symbol;
  if (entry.type === 'fill') return (entry.data as Fill).order_id.slice(0, 8);
  return (entry.data as RiskEvaluation).recommendation_id.slice(0, 8);
}

export function getEntryStatus(entry: TimelineEntry): string {
  if (entry.type === 'fill') return 'filled';
  if (entry.type === 'order') return (entry.data as OrderHistoryEntry).status;
  return (entry.data as RiskEvaluation).allowed ? 'allowed' : 'blocked';
}

export function getEntrySide(entry: TimelineEntry): string | null {
  if (entry.type === 'order') return (entry.data as OrderHistoryEntry).side;
  return null;
}

export function getEntrySummary(entry: TimelineEntry): {
  primary: string;
  secondary: string | null;
} {
  if (entry.type === 'fill') {
    const fill = entry.data as Fill;
    return {
      primary: `${fill.fill_qty} @ ${formatCurrency(fill.fill_price)}`,
      secondary: fill.order_id ? `Order ${fill.order_id.slice(0, 8)}…` : null,
    };
  }
  if (entry.type === 'order') {
    const order = entry.data as OrderHistoryEntry;
    const sideLabel = order.side === 'buy' ? 'BUY' : 'SELL';
    return {
      primary: `${sideLabel} ${order.symbol} × ${order.qty}`,
      secondary:
        order.fill_price != null
          ? `Filled @ ${formatCurrency(order.fill_price)}`
          : order.status === 'cancelled'
            ? 'Cancelled'
            : order.status === 'rejected'
              ? 'Rejected'
              : null,
    };
  }
  const risk = entry.data as RiskEvaluation;
  return {
    primary: risk.allowed
      ? `Approved${risk.adjusted_quantity != null ? ` (qty: ${risk.adjusted_quantity})` : ''}`
      : 'Blocked',
    secondary: risk.reason,
  };
}
