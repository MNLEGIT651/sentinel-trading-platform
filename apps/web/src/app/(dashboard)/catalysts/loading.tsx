import { Skeleton, SkeletonMetricCard } from '@/components/ui/skeleton';

export default function CatalystsLoading() {
  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <Skeleton variant="heading" className="w-36" />
        </div>
        <Skeleton variant="button" className="w-24" />
      </div>

      {/* Date range and filters */}
      <div className="rounded-xl border border-foreground/5 bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Event timeline grouped by date */}
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton variant="text" className="w-32 h-4" />
            {Array.from({ length: 2 }, (_, j) => (
              <div key={j} className="rounded-lg border border-foreground/5 bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton variant="text" className="w-40" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton variant="text" className="w-2/3 h-3" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
