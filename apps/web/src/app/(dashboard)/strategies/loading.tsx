import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function StrategiesLoading() {
  return (
    <div className="space-y-4 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <div className="space-y-1">
          <Skeleton variant="heading" className="w-32" />
          <Skeleton variant="text" className="w-24 h-3" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/30 p-1 w-fit">
        <Skeleton variant="button" className="w-20" />
        <Skeleton variant="button" className="w-28" />
      </div>

      {/* Strategy family sections */}
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton variant="text" className="h-5 w-40" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, j) => (
              <SkeletonCard key={j} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
