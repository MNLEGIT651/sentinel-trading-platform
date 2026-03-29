import { SkeletonCard, SkeletonChart, SkeletonTable } from '@/components/ui/skeleton';

export default function MarketsLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-7 w-32 rounded" />
        <div className="skeleton h-8 w-24 rounded-lg" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <SkeletonTable rows={8} cols={3} />
        <SkeletonChart />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
