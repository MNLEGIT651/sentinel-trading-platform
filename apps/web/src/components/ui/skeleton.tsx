import { cn } from '@/lib/utils';

type SkeletonVariant =
  | 'text'
  | 'heading'
  | 'card'
  | 'chart'
  | 'metric'
  | 'table-row'
  | 'avatar'
  | 'button';

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  lines?: number;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'h-3.5 w-full rounded',
  heading: 'h-5 w-48 rounded',
  card: 'h-32 w-full rounded-xl',
  chart: 'h-64 w-full rounded-xl',
  metric: 'h-8 w-24 rounded',
  'table-row': 'h-10 w-full rounded',
  avatar: 'h-8 w-8 rounded-full',
  button: 'h-8 w-20 rounded-lg',
};

function Skeleton({ variant = 'text', className, lines = 1 }: SkeletonProps) {
  if (lines > 1) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={cn(
              'skeleton',
              variantStyles[variant],
              i === lines - 1 && 'w-3/4',
              className,
            )}
          />
        ))}
      </div>
    );
  }

  return <div className={cn('skeleton', variantStyles[variant], className)} />;
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-32" />
        <Skeleton variant="avatar" className="h-5 w-5" />
      </div>
      <Skeleton variant="metric" />
      <Skeleton variant="text" className="w-20" />
    </div>
  );
}

/** Matches the MetricCard component shape exactly */
function SkeletonMetricCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 relative overflow-hidden',
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-24 h-3" />
        <Skeleton variant="avatar" className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-7 w-28" />
      <Skeleton variant="text" className="w-16 h-3" />
    </div>
  );
}

/** Matches the AlertFeed card shape */
function SkeletonAlertFeed({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-28" />
        <Skeleton variant="avatar" className="h-4 w-4 rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-foreground/5 p-3">
            <Skeleton className="h-5 w-14 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton variant="text" className="w-3/4" />
              <Skeleton variant="text" className="w-1/2 h-3" />
            </div>
            <Skeleton className="h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches signal card items */
function SkeletonSignalCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-28" />
        <Skeleton variant="avatar" className="h-4 w-4 rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-1.5 border-b border-foreground/5 last:border-0"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-10 rounded" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex gap-4 border-b border-border/50 pb-2">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} variant="text" className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4 py-1.5">
          {Array.from({ length: cols }, (_, j) => (
            <Skeleton key={j} variant="text" className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonChart({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton variant="heading" className="w-40" />
        <div className="flex gap-2">
          <Skeleton variant="button" className="w-12" />
          <Skeleton variant="button" className="w-12" />
        </div>
      </div>
      <Skeleton variant="chart" />
    </div>
  );
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonMetricCard,
  SkeletonAlertFeed,
  SkeletonSignalCard,
  SkeletonTable,
  SkeletonChart,
};
