import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function AgentsLoading() {
  return (
    <div className="space-y-4 p-4 page-enter">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <div className="space-y-1">
            <Skeleton variant="heading" className="w-28" />
            <Skeleton variant="text" className="w-40 h-3" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton variant="button" className="w-24" />
          <Skeleton variant="button" className="w-16" />
        </div>
      </div>

      {/* Agent status cards grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Recommendation card */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
        <Skeleton variant="text" className="w-36" />
        <Skeleton variant="text" lines={3} />
      </div>

      {/* Agent alert feed */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
        <Skeleton variant="text" className="w-28" />
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      </div>
    </div>
  );
}
