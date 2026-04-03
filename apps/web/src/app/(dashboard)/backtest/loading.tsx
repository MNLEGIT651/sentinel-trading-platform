import { Skeleton, SkeletonChart, SkeletonTable } from '@/components/ui/skeleton';

export default function BacktestLoading() {
  return (
    <div className="space-y-4 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <div className="space-y-1">
            <Skeleton variant="heading" className="w-28" />
            <Skeleton variant="text" className="w-64 h-3" />
          </div>
        </div>
        <Skeleton variant="button" className="w-20" />
      </div>

      {/* Backtest form skeleton */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-4">
        <Skeleton variant="text" className="w-32" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton variant="text" className="w-20 h-3" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton variant="button" className="w-28" />
      </div>

      {/* Results metrics table */}
      <SkeletonTable rows={4} cols={4} />

      {/* Results tab bar + chart */}
      <div className="flex gap-2 border-b border-border/50 pb-2">
        <Skeleton variant="button" className="w-24" />
        <Skeleton variant="button" className="w-20" />
        <Skeleton variant="button" className="w-24" />
      </div>
      <SkeletonChart />
    </div>
  );
}
