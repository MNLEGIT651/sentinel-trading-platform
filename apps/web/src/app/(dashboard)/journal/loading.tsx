import { Skeleton, SkeletonMetricCard } from '@/components/ui/skeleton';

export default function JournalLoading() {
  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <Skeleton variant="heading" className="w-40" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton variant="button" className="w-32" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton variant="button" className="w-20" />
      </div>

      {/* Journal cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-lg border border-foreground/5 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton variant="text" className="w-2/3" />
            <Skeleton variant="text" className="w-1/2 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}
