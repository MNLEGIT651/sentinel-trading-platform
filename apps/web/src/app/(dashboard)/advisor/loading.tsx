import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';

export default function AdvisorLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-7 w-40 rounded" />
        <div className="skeleton h-8 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}
