import { SkeletonTable } from '@/components/ui/skeleton';

export default function AuditLogLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-7 w-32 rounded" />
        <div className="skeleton h-8 w-28 rounded-lg" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-32 rounded-lg" />
        <div className="skeleton h-9 w-32 rounded-lg" />
        <div className="skeleton h-9 w-32 rounded-lg" />
      </div>
      <SkeletonTable rows={12} cols={5} />
    </div>
  );
}
