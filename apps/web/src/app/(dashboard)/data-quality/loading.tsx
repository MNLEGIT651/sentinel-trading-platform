import { Skeleton, SkeletonMetricCard } from '@/components/ui/skeleton';

export default function DataQualityLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <Skeleton variant="heading" className="w-32" />
        </div>
        <Skeleton variant="button" className="w-24" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-6 w-32 rounded" />
        <Skeleton variant="button" className="w-20 ml-auto" />
      </div>

      {/* Events list */}
      <div className="rounded-xl border border-foreground/5 bg-card ring-1 ring-foreground/10">
        <div className="flex items-center gap-3 border-b border-foreground/5 p-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton variant="text" className="w-40" />
        </div>
        <div className="divide-y divide-foreground/5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton variant="text" className="flex-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
