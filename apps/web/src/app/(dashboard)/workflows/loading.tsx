import { Skeleton } from '@/components/ui/skeleton';

export default function WorkflowsLoading() {
  return (
    <div className="space-y-4 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <Skeleton variant="heading" className="w-28" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>

      {/* Stats summary */}
      <div className="flex gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10"
          >
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton variant="text" className="w-12" />
            <Skeleton variant="metric" className="w-6" />
          </div>
        ))}
      </div>

      {/* Job list header */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="grid grid-cols-[1fr_80px_80px_120px_1fr] gap-2 border-b border-foreground/5 p-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} variant="text" className="h-3" />
          ))}
        </div>

        {/* Job rows */}
        <div className="divide-y divide-foreground/5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_80px_120px_1fr] gap-2 p-3">
              <Skeleton variant="text" className="w-3/4" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton variant="text" className="w-12" />
              <Skeleton variant="text" className="w-20" />
              <Skeleton variant="text" className="w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
