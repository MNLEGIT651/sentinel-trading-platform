import { SkeletonCard, SkeletonChart, SkeletonTable } from '@/components/ui/skeleton';

export default function PortfolioLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-7 w-36 rounded" />
        <div className="flex gap-2">
          <div className="skeleton h-8 w-20 rounded-lg" />
          <div className="skeleton h-8 w-20 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonTable rows={6} cols={5} />
        <SkeletonChart className="h-72" />
      </div>
    </div>
  );
}
