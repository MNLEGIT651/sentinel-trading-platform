import { cn } from '@/lib/utils';

type StatusType = 'active' | 'paused' | 'error' | 'success' | 'warning' | 'idle' | 'pending';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showDot?: boolean;
  className?: string;
}

const statusConfig: Record<StatusType, { bg: string; text: string; dot: string; label: string }> = {
  active: {
    bg: 'bg-profit/10',
    text: 'text-profit',
    dot: 'bg-profit',
    label: 'Active',
  },
  success: {
    bg: 'bg-profit/10',
    text: 'text-profit',
    dot: 'bg-profit',
    label: 'Success',
  },
  paused: {
    bg: 'bg-amber/10',
    text: 'text-amber',
    dot: 'bg-amber',
    label: 'Paused',
  },
  warning: {
    bg: 'bg-amber/10',
    text: 'text-amber',
    dot: 'bg-amber',
    label: 'Warning',
  },
  pending: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    dot: 'bg-primary',
    label: 'Pending',
  },
  error: {
    bg: 'bg-loss/10',
    text: 'text-loss',
    dot: 'bg-loss',
    label: 'Error',
  },
  idle: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
    label: 'Idle',
  },
};

function StatusBadge({ status, label, showDot = true, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label ?? config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        config.bg,
        config.text,
        className,
      )}
    >
      {showDot && (
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full',
            config.dot,
            status === 'active' && 'animate-pulse',
          )}
        />
      )}
      {displayLabel}
    </span>
  );
}

export { StatusBadge };
export type { StatusType };
