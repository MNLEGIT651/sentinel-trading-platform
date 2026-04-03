'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

const selectVariants = cva(
  'flex h-9 w-full appearance-none rounded-lg border bg-background py-1 pr-8 pl-3 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input',
        error:
          'border-loss text-loss ring-3 ring-loss/20 focus-visible:border-loss focus-visible:ring-loss/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type SelectProps = React.ComponentProps<'select'> &
  VariantProps<typeof selectVariants> & {
    'aria-describedby'?: string;
  };

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant, children, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const resolvedVariant = ariaInvalid ? 'error' : variant;

    return (
      <div data-slot="select" className="relative">
        <select
          ref={ref}
          aria-invalid={ariaInvalid}
          className={cn(selectVariants({ variant: resolvedVariant, className }))}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select, selectVariants };
