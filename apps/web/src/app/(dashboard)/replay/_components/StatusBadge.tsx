import { cn } from '@/lib/utils';
import { statusColor, formatEventType } from '../_helpers';

export function StatusBadge({
  status,
  children,
  className: extraClass,
}: {
  status: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusColor(status),
        extraClass,
      )}
    >
      {children ?? formatEventType(status)}
    </span>
  );
}
