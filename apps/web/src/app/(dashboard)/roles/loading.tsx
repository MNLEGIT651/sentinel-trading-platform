import { Skeleton } from '@/components/ui/skeleton';

export default function RolesLoading() {
  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <div className="space-y-1">
          <Skeleton variant="heading" className="w-36" />
          <Skeleton variant="text" className="w-28 h-3" />
        </div>
      </div>

      {/* Your role summary card */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-2">
        <Skeleton variant="text" className="w-28" />
        <Skeleton variant="metric" className="w-20" />
        <Skeleton variant="text" className="w-48 h-3" />
      </div>

      {/* Permissions matrix table */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              <th className="p-3">
                <Skeleton variant="text" className="w-24" />
              </th>
              {Array.from({ length: 4 }, (_, i) => (
                <th key={i} className="p-3">
                  <Skeleton variant="text" className="w-16 mx-auto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, i) => (
              <tr key={i} className="border-b border-foreground/5">
                <td className="p-3">
                  <Skeleton variant="text" className="w-32" />
                </td>
                {Array.from({ length: 4 }, (_, j) => (
                  <td key={j} className="p-3 text-center">
                    <Skeleton className="h-4 w-4 rounded mx-auto" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Team members */}
      <div className="space-y-3">
        <Skeleton variant="text" className="w-32" />
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-foreground/5 bg-card p-3"
          >
            <Skeleton variant="avatar" />
            <div className="flex-1 space-y-1">
              <Skeleton variant="text" className="w-28" />
              <Skeleton variant="text" className="w-40 h-3" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
