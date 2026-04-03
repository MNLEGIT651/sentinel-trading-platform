import { Skeleton, SkeletonMetricCard } from '@/components/ui/skeleton';

export default function OrdersLoading() {
  return (
    <div className="space-y-4 sm:space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <div className="space-y-1">
          <Skeleton variant="heading" className="w-36" />
          <Skeleton variant="text" className="w-48 h-3" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} variant="button" className="w-16" />
          ))}
        </div>
        <Skeleton variant="button" className="w-24" />
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>

      {/* Timeline cards */}
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-foreground/5 bg-card p-3"
          >
            <Skeleton className="h-5 w-14 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton variant="text" className="w-3/4" />
              <Skeleton variant="text" className="w-1/3 h-3" />
            </div>
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
