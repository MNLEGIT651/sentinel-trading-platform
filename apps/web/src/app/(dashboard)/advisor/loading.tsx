import { Skeleton } from '@/components/ui/skeleton';

export default function AdvisorLoading() {
  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Skeleton variant="heading" className="w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton variant="text" className="w-48 h-3" />
        </div>
      </div>

      {/* Profile editor skeleton */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
        <Skeleton variant="text" className="w-28" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border/50 pb-2">
        <Skeleton variant="button" className="w-20" />
        <Skeleton variant="button" className="w-28" />
      </div>

      {/* Thread list */}
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-foreground/5 bg-card p-3"
          >
            <Skeleton variant="avatar" />
            <div className="flex-1 space-y-1">
              <Skeleton variant="text" className="w-2/3" />
              <Skeleton variant="text" className="w-1/3 h-3" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
