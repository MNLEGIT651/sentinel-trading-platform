import { Skeleton } from '@/components/ui/skeleton';

export default function AutonomyLoading() {
  return (
    <div className="space-y-4 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <Skeleton variant="heading" className="w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* System Autonomy Control */}
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
          <Skeleton variant="text" className="w-44" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton variant="button" className="w-24" />
            <Skeleton variant="button" className="w-24" />
          </div>
        </div>

        {/* Strategy Autonomy Table */}
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

      {/* Universe Restrictions */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
        <Skeleton variant="text" className="w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton variant="button" className="w-16" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </div>

      {/* Activity log */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
        <Skeleton variant="text" className="w-44" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      </div>
    </div>
  );
}
