import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';

export default function OrdersLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-7 w-28 rounded" />
        <div className="flex gap-2">
          <div className="skeleton h-8 w-24 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
