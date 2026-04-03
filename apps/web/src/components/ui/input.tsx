'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const inputVariants = cva(
  'flex h-9 w-full rounded-lg border bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input',
        error:
          'border-loss text-loss ring-3 ring-loss/20 placeholder:text-loss/60 focus-visible:border-loss focus-visible:ring-loss/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type InputProps = React.ComponentProps<'input'> &
  VariantProps<typeof inputVariants> & {
    'aria-describedby'?: string;
  };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, type = 'text', 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const resolvedVariant = ariaInvalid ? 'error' : variant;

    return (
      <input
        data-slot="input"
        type={type}
        ref={ref}
        aria-invalid={ariaInvalid}
        className={cn(inputVariants({ variant: resolvedVariant, className }))}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input, inputVariants };
