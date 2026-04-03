import {
  Skeleton,
  SkeletonMetricCard,
  SkeletonSignalCard,
  SkeletonAlertFeed,
} from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-4 page-enter">
      {/* System health strip */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Price ticker */}
      <div className="flex gap-3 overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>

      {/* Signals + Alert feed */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonSignalCard />
        <SkeletonAlertFeed />
      </div>
    </div>
  );
}
