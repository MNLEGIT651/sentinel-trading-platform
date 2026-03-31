import type { LucideIcon } from 'lucide-react';

export function SummaryCard({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-white">{count}</p>
    </div>
  );
}
