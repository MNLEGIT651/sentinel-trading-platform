import { Skeleton, SkeletonMetricCard } from '@/components/ui/skeleton';

export default function ApprovalsLoading() {
  return (
    <div className="space-y-4 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <Skeleton variant="heading" className="w-28" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Filter card */}
      <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <div className="flex gap-1 ml-auto">
            <Skeleton variant="button" className="w-8 h-8" />
            <Skeleton variant="button" className="w-8 h-8" />
          </div>
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      {/* Recommendation cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-lg border border-foreground/5 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-12 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton variant="button" className="w-20" />
                <Skeleton variant="button" className="w-20" />
              </div>
            </div>
            <div className="flex gap-4">
              <Skeleton variant="text" className="w-24" />
              <Skeleton variant="text" className="w-20" />
              <Skeleton variant="text" className="w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
