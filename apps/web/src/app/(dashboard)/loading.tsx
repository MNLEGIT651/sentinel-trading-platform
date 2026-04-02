import {
  SkeletonMetricCard,
  SkeletonAlertFeed,
  SkeletonSignalCard,
  SkeletonChart,
  Skeleton,
} from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* System health strip */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </div>

      {/* Price ticker */}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg bg-card p-3 ring-1 ring-foreground/10 shrink-0 w-36"
          >
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>

      {/* Main content — signals + alerts side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonSignalCard />
        <SkeletonAlertFeed />
      </div>

      {/* Chart section */}
      <SkeletonChart />
    </div>
  );
}
