import { Skeleton, SkeletonChart } from '@/components/ui/skeleton';

export default function MarketsLoading() {
  return (
    <div className="flex h-full flex-col gap-4 p-3 sm:p-4 page-enter">
      {/* Header */}
      <Skeleton variant="heading" className="w-28" />

      {/* Two column: watchlist + chart */}
      <div className="flex flex-1 flex-col gap-4 min-h-0 lg:flex-row">
        {/* Watchlist sidebar */}
        <div className="w-full shrink-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:w-72">
          <div className="flex items-center justify-between mb-3">
            <Skeleton variant="text" className="w-24" />
            <Skeleton variant="avatar" className="h-4 w-4 rounded" />
          </div>
          <div className="space-y-1">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} variant="text" className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1">
          <SkeletonChart className="h-full" />
        </div>
      </div>
    </div>
  );
}
