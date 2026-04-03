import { Skeleton, SkeletonMetricCard, SkeletonTable } from '@/components/ui/skeleton';

export default function PortfolioLoading() {
  return (
    <div className="space-y-4 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <div className="space-y-1">
            <Skeleton variant="heading" className="w-32" />
            <Skeleton variant="text" className="w-20 h-3" />
          </div>
        </div>
        <Skeleton variant="button" className="w-24" />
      </div>

      {/* Snapshot metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border/50 pb-2">
        <Skeleton variant="button" className="w-20" />
        <Skeleton variant="button" className="w-24" />
        <Skeleton variant="button" className="w-16" />
      </div>

      {/* Positions table */}
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
