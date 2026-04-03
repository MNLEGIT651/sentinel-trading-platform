import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function RegimeLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <div className="space-y-1">
          <Skeleton variant="heading" className="w-24" />
          <Skeleton variant="text" className="w-56 h-3" />
        </div>
      </div>

      {/* Current regime card */}
      <SkeletonCard />

      {/* Regime recording buttons */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
        <Skeleton variant="text" className="w-36" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} variant="button" className="w-full h-9" />
          ))}
        </div>
      </div>

      {/* Playbook cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton variant="text" className="w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="space-y-1">
                  <Skeleton variant="text" className="w-16 h-3" />
                  <Skeleton variant="metric" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
