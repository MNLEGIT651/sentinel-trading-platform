import { XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ORDER_STATUS_STEPS = ['pending', 'submitted', 'partial', 'filled'] as const;
export const ORDER_TERMINAL = ['cancelled', 'rejected'] as const;

interface OrderLifecycleBarProps {
  status: string;
}

export function OrderLifecycleBar({ status }: OrderLifecycleBarProps) {
  const isTerminal = (ORDER_TERMINAL as readonly string[]).includes(status);
  const currentIdx = isTerminal
    ? -1
    : ORDER_STATUS_STEPS.indexOf(status as (typeof ORDER_STATUS_STEPS)[number]);

  return (
    <div className="flex items-center gap-1 mt-2">
      {ORDER_STATUS_STEPS.map((step, idx) => {
        const isActive = !isTerminal && idx <= currentIdx;
        const isCurrent = !isTerminal && idx === currentIdx;

        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all',
                idx === 0 ? 'w-4' : 'w-8',
                isActive ? (isCurrent ? 'bg-green-400' : 'bg-green-400/50') : 'bg-zinc-800',
              )}
            />
            {idx < ORDER_STATUS_STEPS.length - 1 && (
              <div
                className={cn('w-1 h-1 rounded-full', isActive ? 'bg-green-400/30' : 'bg-zinc-800')}
              />
            )}
          </div>
        );
      })}
      {isTerminal && (
        <div className="flex items-center gap-1 ml-1">
          <XCircle className="h-3 w-3 text-red-400" />
          <span className="text-[10px] text-red-400 font-medium uppercase">{status}</span>
        </div>
      )}
    </div>
  );
}
