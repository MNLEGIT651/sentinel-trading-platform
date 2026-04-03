import { Skeleton, SkeletonMetricCard } from '@/components/ui/skeleton';

export default function SignalsLoading() {
  return (
    <div className="space-y-4 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <Skeleton variant="heading" className="w-24" />
          <Skeleton variant="button" className="w-12" />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="button" className="w-20" />
          <Skeleton variant="button" className="w-24" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Signal timeline */}
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-foreground/5 bg-card p-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-12 rounded" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
