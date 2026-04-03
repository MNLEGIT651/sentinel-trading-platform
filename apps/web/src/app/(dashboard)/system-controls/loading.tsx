import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function SystemControlsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <div className="space-y-1">
          <Skeleton variant="heading" className="w-40" />
          <Skeleton variant="text" className="w-32 h-3" />
        </div>
      </div>

      {/* Trading mode card */}
      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton variant="text" className="w-28" />
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Skeleton variant="button" className="w-28" />
            <Skeleton variant="button" className="w-28" />
          </div>
        </div>
      </div>

      {/* System configuration cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Strategy autonomy table */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
        <Skeleton variant="text" className="w-40" />
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <Skeleton variant="text" className="w-32" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
