'use client';

import { cn } from '@/lib/utils';
import type { ConfidenceLabel } from '@sentinel/shared';
import { getConfidenceLabel } from '@sentinel/shared';

interface ConfidenceMeterProps {
  confidence: number;
  label?: ConfidenceLabel | undefined;
  showLabel?: boolean | undefined;
  size?: 'sm' | 'default' | undefined;
  className?: string | undefined;
}

const colorMap: Record<ConfidenceLabel, string> = {
  low: 'bg-red-500',
  medium: 'bg-amber-500',
  high: 'bg-emerald-500',
};

const textColorMap: Record<ConfidenceLabel, string> = {
  low: 'text-red-400',
  medium: 'text-amber-400',
  high: 'text-emerald-400',
};

export function ConfidenceMeter({
  confidence,
  label,
  showLabel = true,
  size = 'default',
  className,
}: ConfidenceMeterProps) {
  const resolvedLabel = label ?? getConfidenceLabel(confidence);
  const pct = Math.round(confidence * 100);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'overflow-hidden rounded-full bg-muted',
          size === 'sm' ? 'h-1.5 w-16' : 'h-2 w-24',
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all', colorMap[resolvedLabel])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            'font-mono capitalize',
            size === 'sm' ? 'text-[10px]' : 'text-xs',
            textColorMap[resolvedLabel],
          )}
        >
          {pct}% {resolvedLabel}
        </span>
      )}
    </div>
  );
}
