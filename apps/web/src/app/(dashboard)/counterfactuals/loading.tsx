import { Skeleton, SkeletonMetricCard } from '@/components/ui/skeleton';

export default function CounterfactualsLoading() {
  return (
    <div className="max-w-6xl space-y-6 p-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <div className="space-y-1">
          <Skeleton variant="heading" className="w-44" />
          <Skeleton variant="text" className="w-64 h-3" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} variant="button" className="w-24" />
        ))}
      </div>

      {/* Result cards list */}
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-lg border border-foreground/5 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-12 rounded" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex gap-4">
              <Skeleton variant="text" className="w-20" />
              <Skeleton variant="text" className="w-20" />
              <Skeleton variant="text" className="w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
