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

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonChart };
