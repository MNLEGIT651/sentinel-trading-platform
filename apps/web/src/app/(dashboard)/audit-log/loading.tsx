import { Skeleton, SkeletonMetricCard } from '@/components/ui/skeleton';

export default function AuditLogLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <Skeleton variant="heading" className="w-28" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Filters card */}
      <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <div className="flex gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} variant="button" className="w-16" />
            ))}
          </div>
          <Skeleton className="h-9 w-44 rounded-lg ml-auto" />
        </div>
      </div>

      {/* Actions list */}
      <div className="space-y-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-foreground/5 bg-card p-3"
          >
            <Skeleton className="h-5 w-20 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton variant="text" className="w-2/3" />
              <Skeleton variant="text" className="w-1/3 h-3" />
            </div>
            <Skeleton className="h-3 w-20 shrink-0" />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <Skeleton variant="button" className="w-20" />
        <Skeleton variant="text" className="w-16" />
        <Skeleton variant="button" className="w-20" />
      </div>
    </div>
  );
}
