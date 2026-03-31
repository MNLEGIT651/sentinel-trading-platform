import { STATUS_COLORS } from './_constants';

export function toLocalDatetimeStr(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateStr(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${Number(value).toFixed(2)}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(2)}%`;
}

export function formatEventType(t: string): string {
  return t.replace(/_/g, ' ');
}

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-zinc-500/10 text-zinc-400';
}
