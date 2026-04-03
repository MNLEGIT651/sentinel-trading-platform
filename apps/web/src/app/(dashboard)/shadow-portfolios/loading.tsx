import { Skeleton, SkeletonMetricCard } from '@/components/ui/skeleton';

export default function ShadowPortfoliosLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <Skeleton variant="heading" className="w-44" />
        </div>
        <Skeleton variant="button" className="w-32" />
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-foreground/5 bg-card p-3">
        <Skeleton variant="text" lines={2} />
      </div>

      {/* Portfolio cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton variant="text" className="w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton variant="button" className="w-16" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, j) => (
                <SkeletonMetricCard key={j} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }, (_, j) => (
                <Skeleton key={j} className="h-6 w-20 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
