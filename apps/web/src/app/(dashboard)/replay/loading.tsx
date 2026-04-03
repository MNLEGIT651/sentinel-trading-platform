import { Skeleton, SkeletonChart, SkeletonTable } from '@/components/ui/skeleton';

export default function ReplayLoading() {
  return (
    <div className="space-y-6 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <div className="space-y-1">
          <Skeleton variant="heading" className="w-40" />
          <Skeleton variant="text" className="w-56 h-3" />
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/30 p-1 w-fit">
        <Skeleton variant="button" className="w-40" />
        <Skeleton variant="button" className="w-32" />
      </div>

      {/* Chart */}
      <SkeletonChart />

      {/* Table */}
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}
