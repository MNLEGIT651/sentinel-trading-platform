import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

type ProgressVariant = 'default' | 'success' | 'warning' | 'error';
type ProgressHeight = 'sm' | 'md' | 'lg';

const trackVariants = cva('w-full overflow-hidden rounded-full bg-muted', {
  variants: {
    height: {
      sm: 'h-0.5',
      md: 'h-1',
      lg: 'h-2',
    },
  },
  defaultVariants: {
    height: 'md',
  },
});

const fillColors: Record<ProgressVariant, string> = {
  default: 'bg-primary',
  success: 'bg-profit',
  warning: 'bg-amber',
  error: 'bg-loss',
};

interface ProgressBarProps {
  value: number;
  variant?: ProgressVariant;
  height?: ProgressHeight;
  className?: string;
}

function ProgressBar({ value, variant = 'default', height = 'md', className }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      data-slot="progress-bar"
      className={cn(trackVariants({ height }), className)}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-300', fillColors[variant])}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}

export { ProgressBar, trackVariants };
export type { ProgressBarProps, ProgressVariant, ProgressHeight };
