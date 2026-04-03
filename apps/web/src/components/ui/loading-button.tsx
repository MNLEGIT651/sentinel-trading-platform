'use client';

import * as React from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type LoadingButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
  };

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    { className, variant = 'default', size = 'default', loading = false, children, ...props },
    ref,
  ) => {
    return (
      <ButtonPrimitive
        ref={ref}
        data-slot="button"
        disabled={loading || props.disabled}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {loading && <Spinner size="sm" className="shrink-0" />}
        {children}
      </ButtonPrimitive>
    );
  },
);

LoadingButton.displayName = 'LoadingButton';

export { LoadingButton };
export type { LoadingButtonProps };
