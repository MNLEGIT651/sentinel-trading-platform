import { Skeleton, SkeletonMetricCard } from '@/components/ui/skeleton';

export default function ExperimentLoading() {
  return (
    <div className="space-y-6 p-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <div className="space-y-1">
          <Skeleton variant="heading" className="w-52" />
          <Skeleton variant="text" className="w-40 h-3" />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between rounded-lg border border-foreground/5 bg-card p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton variant="text" className="w-32" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="button" className="w-20" />
          <Skeleton variant="button" className="w-16" />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Collapsible sections */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
        <Skeleton variant="text" className="w-28" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton variant="text" className="w-20 h-3" />
              <Skeleton variant="metric" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
        <Skeleton variant="text" className="w-32" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      </div>
    </div>
  );
}
