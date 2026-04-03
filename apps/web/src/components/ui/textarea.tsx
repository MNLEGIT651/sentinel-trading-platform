'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
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

type TextareaProps = React.ComponentProps<'textarea'> &
  VariantProps<typeof textareaVariants> & {
    'aria-describedby'?: string;
  };

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const resolvedVariant = ariaInvalid ? 'error' : variant;

    return (
      <textarea
        data-slot="textarea"
        ref={ref}
        aria-invalid={ariaInvalid}
        className={cn(textareaVariants({ variant: resolvedVariant, className }))}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };
