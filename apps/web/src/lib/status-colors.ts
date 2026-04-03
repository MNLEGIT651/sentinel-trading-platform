// ─── Generic Status Colors ──────────────────────────────────────────────

export const statusColorMap = {
  success: { bg: 'bg-profit/10', text: 'text-profit', border: 'border-profit/20' },
  error: { bg: 'bg-loss/10', text: 'text-loss', border: 'border-loss/20' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  info: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  neutral: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
} as const;

export type StatusKey = keyof typeof statusColorMap;

export function getStatusColors(status: StatusKey) {
  return statusColorMap[status];
}

// ─── Order Status Colors ────────────────────────────────────────────────

export const orderStatusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-zinc-500/15', text: 'text-zinc-400' },
  submitted: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  partial: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  filled: { bg: 'bg-green-500/15', text: 'text-green-400' },
  cancelled: { bg: 'bg-zinc-500/15', text: 'text-zinc-500' },
  rejected: { bg: 'bg-red-500/15', text: 'text-red-400' },
};

export const DEFAULT_ORDER_STYLE = { bg: 'bg-zinc-500/15', text: 'text-zinc-400' };

// ─── Recommendation / Pipeline Status Colors ────────────────────────────

export const pipelineStatusColors: Record<string, string> = {
  created: 'bg-blue-500/10 text-blue-400',
  pending: 'bg-blue-500/10 text-blue-400',
  pending_approval: 'bg-blue-500/10 text-blue-400',
  new: 'bg-blue-500/10 text-blue-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  filled: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
  risk_blocked: 'bg-red-500/10 text-red-400',
  failed: 'bg-red-500/10 text-red-400',
  cancelled: 'bg-red-500/10 text-red-400',
  submitted: 'bg-amber-500/10 text-amber-400',
  partially_filled: 'bg-amber-500/10 text-amber-400',
  risk_checked: 'bg-zinc-500/10 text-zinc-400',
  reviewed: 'bg-zinc-500/10 text-zinc-400',
};

export function getPipelineStatusColor(status: string): string {
  return pipelineStatusColors[status] ?? 'bg-zinc-500/10 text-zinc-400';
}

// ─── Signal Strength Colors ─────────────────────────────────────────────

export function getSignalStrengthColor(strength: number): string {
  if (strength > 0.7) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
  if (strength >= 0.5) return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
  return 'text-red-400 border-red-500/20 bg-red-500/10';
}

// ─── Side Colors ────────────────────────────────────────────────────────

export const sideColors: Record<string, string> = {
  buy: 'bg-emerald-500/10 text-emerald-400',
  sell: 'bg-red-500/10 text-red-400',
};
