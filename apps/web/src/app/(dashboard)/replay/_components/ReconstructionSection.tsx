import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ReconstructionSection({
  title,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        {title}
      </h3>
      {children}
    </div>
  );
}
