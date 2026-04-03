import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-4 px-4 py-3 md:p-4 page-enter">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <div className="space-y-1">
            <Skeleton variant="heading" className="w-28" />
            <Skeleton variant="text" className="w-64 h-3" />
          </div>
        </div>
        <Skeleton variant="button" className="w-20" />
      </div>

      {/* Connection status panel */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton variant="text" className="w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border/50 pb-2">
        <Skeleton variant="button" className="w-16" />
        <Skeleton variant="button" className="w-20" />
        <Skeleton variant="button" className="w-20" />
        <Skeleton variant="button" className="w-20" />
      </div>

      {/* Settings form sections */}
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
            <Skeleton variant="text" className="w-32" />
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton variant="text" className="w-40" />
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
