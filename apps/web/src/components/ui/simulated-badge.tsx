'use client';

import { cn } from '@/lib/utils';

export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-400 uppercase',
        className,
      )}
    >
      Paper
    </span>
  );
}
