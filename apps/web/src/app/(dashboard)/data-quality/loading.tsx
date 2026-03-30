import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';

export default function DataQualityLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-7 w-36 rounded" />
        <div className="skeleton h-8 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonTable rows={10} cols={5} />
    </div>
  );
}
