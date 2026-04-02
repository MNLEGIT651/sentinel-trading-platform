'use client';

import { cn } from '@/lib/utils';

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function ToggleField({ label, description, checked, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex w-12 shrink-0 items-center justify-end">
        <button
          onClick={() => onChange(!checked)}
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            checked ? 'bg-primary' : 'bg-muted',
          )}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
              checked && 'translate-x-5',
            )}
          />
        </button>
      </div>
    </div>
  );
}
